import "dotenv/config";
import axios from "axios";
import { google } from "googleapis";


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

    .filter(d =>
      d.getFullYear() === currentYear
    )

    // LOCAL DATE NOT UTC
    .map(d => {
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
      ].join("-");
    });

  // remove duplicates
  const uniqueDates = [...new Set(dates)];

  console.log(uniqueDates);

  return longestStreak(uniqueDates);
}
// ---------------- TRYHACKME ----------------
// No proper public streak API
async function run() {
console.log(await codeforcesStreak('gr_priyk'));
}

run()