import "dotenv/config";
import axios from "axios";
import { google } from "googleapis";

const delay = ms =>
  new Promise(res =>
    setTimeout(res, ms)
  );

// ---------------- CONFIG ----------------
const SHEET_ID = process.env.STREAK_SHEET;

// G COLUMN = Profile Link
const DATA_RANGE = "Form responses 1!G2:L";

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// ---------------- GET SHEET DATA ----------------
async function getSheetData(auth) {
  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: DATA_RANGE,
  });

  return res.data.values || [];
}

// ---------------- LONGEST STREAK ----------------
function longestStreak(dates) {

  if (dates.length === 0) {
    return {
      streak: 0,
      startDate: null,
      endDate: null
    };
  }

  // remove duplicates
  dates = [...new Set(dates)];

  // sort
  dates.sort();

  let longest = 1;
  let current = 1;

  let longestStart = dates[0];
  let longestEnd = dates[0];

  let currentStart = dates[0];

  for (let i = 1; i < dates.length; i++) {

    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);

    const diff =
      (curr - prev) / (1000 * 60 * 60 * 24);

    // consecutive
    if (diff === 1) {

      current++;

    } else {

      if (current > longest) {
        longest = current;
        longestStart = currentStart;
        longestEnd = dates[i - 1];
      }

      current = 1;
      currentStart = dates[i];
    }
  }

  // final check
  if (current > longest) {
    longest = current;
    longestStart = currentStart;
    longestEnd = dates[dates.length - 1];
  }

  return {
    streak: longest,
    startDate: longestStart,
    endDate: longestEnd
  };
}

// ---------------- MARKS ----------------
function calculateMarks(days) {

  if (days < 50) return 0;

  let marks = 5 + Math.floor((days - 50) / 5);

  return Math.min(marks, 10);
}

// ---------------- GITHUB ----------------
async function githubStreak(username) {

  const query = {
    query: `
    query($login:String!) {
      user(login:$login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
    `,
    variables: {
      login: username
    }
  };

  const res = await axios.post(
    "https://api.github.com/graphql",
    query,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
      }
    }
  );

  const days =
    res.data.data.user.contributionsCollection
      .contributionCalendar.weeks
      .flatMap(w => w.contributionDays);

  const currentYear = new Date().getFullYear();

  const dates = days
    .filter(
      d =>
        d.contributionCount > 0 &&
        new Date(d.date).getFullYear() === currentYear
    )
    .map(d => d.date);

  return longestStreak(dates);
}

// ---------------- LEETCODE ----------------
async function leetcodeStreak(username) {

  const query = {
    query: `
      query($username: String!) {
        matchedUser(username: $username) {
          userCalendar {
            submissionCalendar
          }
        }
      }
    `,
    variables: {
      username
    }
  };

  const res = await axios.post(
    "https://leetcode.com/graphql",
    query
  );

  const calendar = JSON.parse(
    res.data.data.matchedUser
      .userCalendar.submissionCalendar
  );

  const currentYear = new Date().getFullYear();

  const dates = Object.entries(calendar)
    .filter(([ts, count]) => {

      const d = new Date(ts * 1000);

      return (
        count > 0 &&
        d.getFullYear() === currentYear
      );
    })
    .map(([ts]) =>
      new Date(ts * 1000)
        .toISOString()
        .split("T")[0]
    );

  return longestStreak(dates);
}

// ---------------- CODEFORCES ----------------
async function codeforcesStreak(username) {

  const res = await axios.get(
    `https://codeforces.com/api/user.status?handle=${username}`
  );

  const submissions = res.data.result;

  const currentYear = new Date().getFullYear();

  const dates = submissions
    .map(sub =>
      new Date(sub.creationTimeSeconds * 1000)
    )
    .filter(d => d.getFullYear() === currentYear)
    .map(d =>
      d.toISOString().split("T")[0]
    );

  return longestStreak(dates);
}

// ---------------- TRYHACKME ----------------
// No proper public streak API
async function tryhackmeStreak() {

}

// ---------------- MAIN ----------------
async function main() {

  const client = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: client
  });

  const rows = await getSheetData(client);

  for (let i = 0; i < rows.length; i++) {
    
    const rowNumber = i + 2;

    const link = rows[i][0];

    console.log("\nROW:", rowNumber);
    console.log("LINK:", link);
    

    let Data = {
      streak: 0,
      startDate: "",
      endDate: ""
    };

    // skip invalid
    if (
      !link ||
      link.toLowerCase() === "na" ||
      link.startsWith("https://drive")
    ) {
      continue;
    }


    let username = "";

    try {

      // ---------------- GITHUB ----------------
      if (link.includes("github.com")) {

        username =
          link.split("github.com/")[1]
            .split("/")[0];

        Data = await githubStreak(username);
      }

      // ---------------- LEETCODE ----------------
      else if (link.includes("leetcode.com")) {

        username =
          link.split("/u/")[1]
            .split("/")[0];

        Data = await leetcodeStreak(username);
      }

      // ---------------- CODEFORCES ----------------
      else if (link.includes("codeforces.com")) {

        username =
          link.split("/profile/")[1];

        Data = await codeforcesStreak(username);
      }

      // ---------------- TRYHACKME ----------------
      else if (link.includes("tryhackme.com")) {

        continue;
      }

      const marks = calculateMarks(Data.streak);

      console.log("Evaluating - ",username);

      const result = [
        `󠁯•󠁏 Username: ${username}`,
        `󠁯•󠁏 Link: ${link}`,
        `󠁯•󠁏 Streak: ${Data.streak} Days. From: ${Data.startDate} - Till: ${Data.endDate}`,
        `󠁯•󠁏 Marks: ${marks}`
      ].join("\n");

      // WRITE TO SHEET
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,

        // L = Marks
        // M = Full Result
        range: `L${rowNumber}:M${rowNumber}`,

        valueInputOption: "RAW",

        requestBody: {
          values: [[
            marks,
            result
          ]]
        }
      });

    } catch (err) {

      console.log(
        "ERROR ROW:",
        rowNumber
      );

      console.log(err.message);
    }
    await delay(500)
    console.log("Done");
  }
}

main();