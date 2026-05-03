import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import axios from "axios";
import { file_identifier_prompt, content_eval_prompt } from "./prompt_new.js";
import "dotenv/config";


const client = new Anthropic();
// // ─── Delay ───────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

//─── Google Sheets ───────────────────────────────────────────────────────────

async function getSheetData(auth) {
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Form responses 1!A2:H5",
  });
  return res.data.values || [];
}

async function updateSheet(auth, rowIndex, result) {
  const sheets = google.sheets({ version: "v4", auth });
  const diag = result.breakdown.diagram_dist;

  const summaryText = Array.isArray(result.summary)
    ? result.summary.join("\n")
    : result.summary;

  const rel = result.relevance_summary || {};
  const relevanceText = [
    `• idea.md: ${rel["idea.md"] || "N/A"}`,
    `• useCaseDiagram.md: ${rel["useCaseDiagram.md"] || "N/A"}`,
    `• sequenceDiagram.md: ${rel["sequenceDiagram.md"] || "N/A"}`,
    `• classDiagram.md: ${rel["classDiagram.md"] || "N/A"}`,
    `• ErDiagram.md: ${rel["ErDiagram.md"] || "N/A"}`,
  ].join("\n");

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Form responses 1!I${rowIndex}:R${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          diag["idea.md"] || 0,
          diag["useCaseDiagram.md"] || 0,
          diag["sequenceDiagram.md"] || 0,
          diag["classDiagram.md"] || 0,
          diag["ErDiagram.md"] || 0,
          result.breakdown.backend || 0,
          result.breakdown.frontend || 0,
          result.final_score || 0,
          summaryText || "",
          relevanceText || "",
        ],
      ],
    },
  });
  console.log("DONE");
}

// // ─── GitHub ──────────────────────────────────────────────────────────────────

function parseRepoUrl(repoUrl) {
  const parts = repoUrl.replace("https://github.com/", "").split("/");
  return { owner: parts[0], repo: parts[1] };
}

async function getReportData(repoUrl) {
  try {
    const { owner, repo } = parseRepoUrl(repoUrl);
    const headers = { Authorization: `token ${process.env.GITHUB_TOKEN}` };

    
    let readmeData = "";
    let filesData = [];
    let aboutData = { description: "", website: "" };

    try {
      const meta = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers },
      );
      aboutData = {
        description: meta.data.description || "",
        website: meta.data.homepage || "",
      };
    } catch {
      console.log(`No metadata for ${owner}/${repo}`);
    }

    try {
      const readme = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/readme`,
        { headers },
      );
      readmeData = Buffer.from(readme.data.content, "base64").toString();
    } catch {
      console.log(`No README for ${owner}/${repo}`);
    }

    try {
      const files = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents`,
        { headers },
      );
      filesData = files.data.map((f) => f.name);
    } catch {
      console.log(`Cannot access repo ${owner}/${repo}`);
      return null;
    }

    return { readme: readmeData, files: filesData, about: aboutData };
  } catch {
    console.log("Invalid repo URL:", repoUrl);
    return null;
  }
}

async function fetchFileContent(owner, repo, filePath) {
  try {
    const headers = { Authorization: `token ${process.env.GITHUB_TOKEN}` };
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      { headers },
    );
    return Buffer.from(res.data.content, "base64").toString();
  } catch {
    return null;
  }
}

// // ─── Anthropic / LLM ─────────────────────────────────────────────────────────

async function askClaude(prompt) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text;
  const clean = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    console.error("JSON parse failed. Raw output:\n", text);
    return null;
  }
}

// // ─── Core Evaluator ──────────────────────────────────────────────────────────

async function evalRepo(repoData, repoUrl) {
  const { owner, repo } = parseRepoUrl(repoUrl);

  const identifyPrompt = file_identifier_prompt(repoData.files, owner, repo);
  const fileMap = await askClaude(identifyPrompt);

  const fileContents = {};
  for (const [key, url] of Object.entries(fileMap)) {
    if (!url) {
      fileContents[key] = null;
      continue;
    }
    const filePath = url.split("/blob/main/")[1];
    fileContents[key] = await fetchFileContent(owner, repo, filePath);
  }

  const evalPrompt = content_eval_prompt(
    fileMap,
    fileContents,
    repoData.readme,
    repoData.files,
    repoData.about,
  );

  return await askClaude(evalPrompt);
}

// // ─── Main Runner ─────────────────────────────────────────────────────────────
const DELAY_MS = 12000;
const TOTAL_ROWS = 441;

async function run() {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const rows = await getSheetData(auth);
  let evaluated = 0;

  for (let i = 0; i < rows.length; i++) {
    const repoUrl = rows[i][7];
    const studentName = rows[i][2];

    if (!repoUrl) continue;

    const repoData = await getReportData(repoUrl);
    if (!repoData) {
      console.log(`Skipping ${studentName} — repo inaccessible`);
      continue;
    }

    console.log(`[${i + 1}/${TOTAL_ROWS}] Evaluating: ${studentName}`);

    try {
      const result = await evalRepo(repoData, repoUrl);
      await updateSheet(auth, i + 2, result);
      evaluated++;

      const eta = Math.ceil(((TOTAL_ROWS - (i + 1)) * DELAY_MS) / 60000);
      console.log(
        `✓ Done — ${evaluated} evaluated so far | ETA: ~${eta} min remaining`,
      );
    } catch (err) {
      console.log(err);
    }

    await delay(DELAY_MS);
  }

  console.log("\nAll done!");
}

// ─── Entry Point ─────────────────────────────────────────────────────────────
run();
