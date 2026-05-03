import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import "dotenv/config";

const client = new Anthropic();

// ─── Config ───────────────────────────────────────────────────────────────────

const SHEET_ID = process.env.CASE_STUDY_SHEET_ID;
const SHEET_NAME = "Form responses 1";
const DATA_RANGE = `${SHEET_NAME}!A2:J155`; 
const DELAY_MS = 15000; // 15s delay — safe for TPM/RPM limits

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = (driveLink, blogLink) => `You are a strict case study evaluator.

You are given two possible links:
- Google Drive / Report Link: ${driveLink || "NOT PROVIDED"}
- Blog Link (Medium/other): ${blogLink || "NOT PROVIDED"}

Try to access both links. Use whichever has readable content. If both are accessible, prefer the one with more complete content. If neither is accessible, return: {"error": "Unable to access any provided link."}.

Evaluate the case study on any topic (technical or non-technical) and return ONLY valid JSON, no extra text, no markdown.

Scoring: 0-5 total
- research_and_references: 0-1.5 (claims backed by data/sources? depth of research?)
- clarity_and_structure: 0-1.5 (is problem, solution, and conclusion clearly presented?)
- impact_and_insight: 0-2 (real-world relevance, originality, depth of analysis?)

Grade thresholds: 5=Excellent, 4=Good, 3=Satisfactory, <3=Needs Improvement

Return this JSON only:
{
  "title": "",
  "source_used": "",
  "final_score": 0,
  "scores": {
    "research_and_references": 0,
    "clarity_and_structure": 0,
    "impact_and_insight": 0
  },
  "feedback": ""
}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed.startsWith("http") ? trimmed : null;
}

// ─── Google Sheets ────────────────────────────────────────────────────────────

async function getSheetData(auth) {
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: DATA_RANGE,
  });
  return res.data.values || [];
}

async function updateSheetRow(auth, rowIndex, result) {
  const sheets = google.sheets({ version: "v4", auth });

  // Columns M(13), N(14), O(15), P(16), Q(17) → range M:Q
  const range = `${SHEET_NAME}!M${rowIndex}:Q${rowIndex}`;

  const scores = result.scores || {};

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          scores.research_and_references ?? "",
          scores.clarity_and_structure ?? "",
          scores.impact_and_insight ?? "",
          result.final_score ?? "",
          result.feedback ?? "",
        ],
      ],
    },
  });
}

// ─── Claude Evaluator ────────────────────────────────────────────────────────

async function evaluateCaseStudy(driveLink, blogLink) {
  const prompt = SYSTEM_PROMPT(driveLink, blogLink);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text;
  const clean = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    console.error("  ✗ JSON parse failed. Raw output:\n", text);
    return null;
  }
}

// ─── Main Runner ──────────────────────────────────────────────────────────────

async function run() {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const rows = await getSheetData(auth);
  console.log(`\nFetched ${rows.length} rows. Starting evaluation...\n`);

  let evaluated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 2; // Sheet row (1-indexed + header)

    const studentName = row[2] || `Row ${rowIndex}`;
    const driveLink = sanitizeUrl(row[8]); // Col I (index 8)
    const blogLink = sanitizeUrl(row[9]);  // Col J (index 9)

    // Skip if both links are missing
    if (!driveLink && !blogLink) {
      console.log(`[${i + 1}/154] ⚠ SKIP — ${studentName} (no links provided)`);
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/154] Evaluating: ${studentName}`);
    console.log(`  Drive: ${driveLink || ""}  |  Blog: ${blogLink || ""}`);

    try {
      const result = await evaluateCaseStudy(driveLink, blogLink);

      if (!result || result.error) {
        console.log(`  ✗ Could not evaluate — ${result?.error || "null result"}`);
        failed++;
      } else {
        await updateSheetRow(auth, rowIndex, result);
        evaluated++;
        console.log(`  ✓ Score: ${result.final_score}/5 | Source: ${result.source_used}`);
      }
    } catch (err) {
      console.error(`  ✗ Error for ${studentName}:`, err.message);
      failed++;
    }

    // Delay to respect TPM/RPM limits
    if (i < rows.length - 1) {
      const eta = Math.ceil(((rows.length - (i + 1)) * DELAY_MS) / 60000);
      console.log(`  ⏳ Waiting ${DELAY_MS / 1000}s... ETA: ~${eta} min remaining\n`);
      await delay(DELAY_MS);
    }
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`Evaluated : ${evaluated}`);
  console.log(`Skipped   : ${skipped}`);
  console.log(`Failed    : ${failed}`);
  console.log("─────────────────────────────────────────");
  console.log("All done!");
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

run();