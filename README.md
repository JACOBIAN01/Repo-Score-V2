# SESD-Agent 

> **Three automated AI-powered grading pipelines for SESD submissions** — evaluates GitHub projects, case studies, and coding streaks. Reads from Google Sheets, scores with Claude & platform APIs, and writes results back. Fully hands-free.

---

## Table of Contents

- [Overview](#overview)
- [Pipelines](#pipelines)
  - [1. Project Evaluator — `sesd-eval.js`](#1-project-evaluator--sesd-evaljs)
  - [2. Case Study Evaluator — `sesd-case-study-ai.js`](#2-case-study-evaluator--sesd-case-study-aijs)
  - [3. Streak Evaluator — `sesd-streak.js`](#3-streak-evaluator--sesd-streakjs)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Dependencies](#dependencies)
- [Notes & Tips](#notes--tips)

---

## Overview

**SESD-Agent** is a Node.js CLI toolkit with three independent grading pipelines, each targeting a different component of the SESD final assessment:

| Pipeline | File | Evaluates | Scores out of |
|---|---|---|---|
| Project Evaluator | `sesd-eval.js` | GitHub repo (docs + code) | 10 |
| Case Study Evaluator | `sesd-case-study-ai.js` | Blog / Google Drive report | 5 |
| Streak Evaluator | `sesd-streak.js` | Coding platform activity | 10 |

All three read from Google Sheets and write results back to their respective output columns.

---

## Pipelines

---

### 1. Project Evaluator — `sesd-eval.js`

Evaluates student GitHub repositories for documentation quality and code structure.

#### How It Works

```
Google Sheet (submissions)
        │
        ▼
  Read student data (name, repo URL, batch, lab)
        │
        ▼
  GitHub API — fetch repo metadata, README, file tree
        │
        ▼
  Claude — Pass 1: Identify required documentation files
        │
        ▼
  GitHub API — fetch identified file contents
        │
        ▼
  Claude — Pass 2: Evaluate quality & project relevance
        │
        ▼
  Google Sheet — write scores + feedback (cols I–R)
```

Each student requires **2 Claude API calls**: one to identify required files, one to score them.

#### Scoring Rubric

| Component | Criteria | Marks |
|---|---|---|
| `idea.md` | Project overview with meaningful content | 1 |
| Use Case Diagram | Relevant to the student's specific project | 1 |
| Sequence Diagram | Relevant to the student's specific project | 1 |
| Class Diagram | Relevant to the student's specific project | 1 |
| ER Diagram | Relevant to the student's specific project | 1 |
| Backend Code | Quality, OOP principles, structure | 3 |
| Frontend + Live Link | UI quality and deployed link | 2 |
| **Total** | | **10** |

> ⚠️ Each diagram earns its mark **only if** it contains meaningful content **and** is directly relevant to the student's project — not a generic or copied template.

#### Google Sheet Format

Sheet name: **`Form responses 1`** | Env var: `GOOGLE_SHEET_ID`

**Input columns (read by script):**

| Col | Field |
|---|---|
| A | Timestamp |
| B | Email address |
| C | Student Name |
| D | URN |
| E | ADYPU Email |
| F | Batch |
| G | Lab |
| H | GitHub Repository URL |

**Output columns (written by script):**

| Col | Content |
|---|---|
| I | `idea.md` score (0 or 1) |
| J | Use Case Diagram score (0 or 1) |
| K | Sequence Diagram score (0 or 1) |
| L | Class Diagram score (0 or 1) |
| M | ER Diagram score (0 or 1) |
| N | Backend score (0–3) |
| O | Frontend score (0–2) |
| P | **Final score (0–10)** |
| Q | Summary feedback |
| R | File-by-file relevance justification |

#### Required Diagrams — Flexible Matching

The evaluator uses flexible name + extension matching to locate required files:

| Required File | Accepted Filename Patterns | Accepted Extensions |
|---|---|---|
| `idea.md` | `idea`, `project-idea`, `about`, `overview` | `.md`, `.txt`, `.pdf`, … |
| Use Case Diagram | `usecase`, `use-case`, `usecasediagram` | `.md`, `.jpg`, `.png`, `.svg`, … |
| Sequence Diagram | `sequence`, `seq`, `seq-diagram` | `.md`, `.jpg`, `.png`, `.drawio`, … |
| Class Diagram | `class`, `class-diagram`, `classdiagram` | `.md`, `.jpg`, `.png`, `.svg`, … |
| ER Diagram | `er`, `erd`, `database`, `erdiagram` | `.md`, `.jpg`, `.png`, `.drawio`, … |

Image files are accepted — a valid, accessible URL counts as meaningful content. Relevance is judged by filename and folder path semantics.

#### Rate Limits & Performance

| Metric | Value |
|---|---|
| Anthropic RPM limit | 50 req/min |
| Agent's effective usage | ~8 req/min ✅ |
| Anthropic TPM limit | 40,000 tokens/min |
| Agent's effective usage | ~24,000 tokens/min ✅ |
| API calls per student | 2 (identify + evaluate) |
| Delay between students | 15 seconds (configurable) |
| **Estimated time for 441 students** | **~110 minutes** |

#### Running

```bash
node sesd-eval.js
```

Adjust the delay between students inside `sesd-eval.js`:

```js
const DELAY_MS = 15000; // milliseconds
```

---

### 2. Case Study Evaluator — `sesd-case-study-ai.js`

Evaluates student case studies submitted as a Google Drive report or a blog post (Medium or similar).

#### How It Works

```
Google Sheet (submissions)
        │
        ▼
  Read student data + two links (Drive, Blog) — cols I & J
        │
        ▼
  Claude — attempts to access both links,
           prefers whichever has more complete content
        │
        ▼
  Claude — evaluates case study on research, clarity, and insight
        │
        ▼
  Google Sheet — write sub-scores + final score + feedback (cols M–Q)
```

**1 Claude API call per student.**

#### Scoring Rubric

| Component | Criteria | Marks |
|---|---|---|
| Research & References | Are claims backed by sources? Depth of research? | 0–1 |
| Clarity & Structure | Is the problem, solution, and conclusion clearly presented? | 0–2 |
| Impact & Insight | Real-world relevance, originality, depth of analysis | 0–2 |
| **Total** | | **5** |

**Grade thresholds:** 5 = Excellent · 4 = Good · 3 = Satisfactory · <3 = Needs Improvement

#### Google Sheet Format

Sheet name: **`Form responses 1`** | Env var: `CASE_STUDY_SHEET_ID`

**Input columns (read by script):**

| Col | Field |
|---|---|
| I | Google Drive / Report link |
| J | Blog link (Medium / other) |

**Output columns (written by script):**

| Col | Content |
|---|---|
| M | `research_and_references` score (0–1) |
| N | `clarity_and_structure` score (0–2) |
| O | `impact_and_insight` score (0–2) |
| P | **Final score (0–5)** |
| Q | Feedback |

#### Link Handling

- If **both links** are provided, Claude tries both and uses whichever has more complete content.
- If **only one** is provided, Claude uses that one.
- If **neither** is accessible, Claude returns an error and the row is marked as failed — no scores are written.
- Rows with **no links at all** are skipped entirely.

#### Rate Limits & Performance

| Metric | Value |
|---|---|
| API calls per student | 1 |
| Delay between students | 15 seconds |
| Batch size | 154 rows (`A2:J155`) |
| **Estimated time for 154 students** | **~40 minutes** |

#### Running

```bash
node sesd-case-study-ai.js
```

---

### 3. Streak Evaluator — `sesd-streak.js`

Evaluates student coding activity by computing the **longest streak of consecutive contribution days** in the current calendar year, across three platforms: GitHub, LeetCode, and Codeforces.

#### How It Works

```
Google Sheet (submissions)
        │
        ▼
  Read profile link (col G) per student
        │
        ▼
  Detect platform from URL
  (github.com / leetcode.com / codeforces.com)
        │
        ├── GitHub     → GraphQL API (contributionCalendar)
        ├── LeetCode   → GraphQL API (submissionCalendar)
        └── Codeforces → REST API   (user.status)
        │
        ▼
  Compute longest consecutive-day streak (current year only)
        │
        ▼
  Convert streak → marks (0–10)
        │
        ▼
  Google Sheet — write marks + summary (cols L–M)
```

No LLM involved — pure platform API calls.

#### Marks Calculation

Marks kick in at a 50-day streak and scale up by 1 mark per additional 5 days, capped at 10.

| Streak (days) | Marks |
|---|---|
| < 50 | 0 |
| 50 | 5 |
| 55 | 6 |
| 60 | 7 |
| 65 | 8 |
| 70 | 9 |
| ≥ 75 | 10 (capped) |

Formula: `marks = min(5 + floor((streak - 50) / 5), 10)`

#### Supported Platforms

| Platform | URL Pattern | API Used |
|---|---|---|
| GitHub | `github.com/<username>` | GitHub GraphQL API |
| LeetCode | `leetcode.com/u/<username>` | LeetCode GraphQL API |
| Codeforces | `codeforces.com/profile/<handle>` | Codeforces REST API |
| TryHackMe | `tryhackme.com/…` | ⏭ Skipped (no public streak API) |
| Google Drive links | `drive.google.com/…` | ⏭ Skipped |
| `NA` or blank | — | ⏭ Skipped |

#### Google Sheet Format

Sheet name: **`Form responses 1`** | Env var: `STREAK_SHEET`

**Input columns (read by script):**

| Col | Field |
|---|---|
| G | Coding platform profile link |

**Output columns (written by script):**

| Col | Content |
|---|---|
| L | Marks (0–10) |
| M | Full result summary (username · link · streak range · marks) |

#### Running

```bash
node sesd-streak.js
```

> The delay between rows is **500ms** — much faster than the Claude pipelines since no LLM is involved.

---

## Project Structure

```
SESD-Agent/
├── sesd-eval.js              # Pipeline 1: GitHub project evaluator
├── sesd-case-study-ai.js     # Pipeline 2: Case study evaluator (Claude)
├── sesd-streak.js            # Pipeline 3: Coding streak evaluator
├── prompt_new.js             # Prompts for Pipeline 1 (file identifier + evaluator)
├── prompt-case-study.js      # Prompts for Pipeline 2
├── credentials.json          # Google service account key (NOT committed)
├── .env                      # Environment variables (NOT committed)
├── package.json
├── package-lock.json
└── .gitignore
```

---

## Prerequisites

- **Node.js** v18+ (ESM modules — `"type": "module"` in `package.json`)
- An **Anthropic API key** (Pipelines 1 & 2)
- A **GitHub Personal Access Token** — read-only scope is sufficient (Pipelines 1 & 3)
- A **Google Cloud service account** with Editor access to the target Google Sheets
- Properly formatted Google Sheets for each pipeline (separate sheets, separate IDs)

---

## Setup & Installation

### 1. Clone and install

```bash
git clone https://github.com/JACOBIAN01/SESD-Agent.git
cd SESD-Agent
npm install
```

### 2. Create your `.env` file

```env
# Anthropic — Pipelines 1 & 2
ANTHROPIC_API_KEY=sk-ant-...

# GitHub — Pipelines 1 & 3
GITHUB_TOKEN=ghp_...

# Google Sheet IDs — one per pipeline
GOOGLE_SHEET_ID=...         # Pipeline 1: sesd-eval.js
CASE_STUDY_SHEET_ID=...     # Pipeline 2: sesd-case-study-ai.js
STREAK_SHEET=...            # Pipeline 3: sesd-streak.js
```

### 3. Add Google service account credentials

Place your Google service account key as `credentials.json` in the project root. The service account must have **Editor** access to all target Google Sheets.

> **How to get a service account key:**
> 1. Go to [Google Cloud Console](https://console.cloud.google.com/)
> 2. Navigate to **IAM & Admin → Service Accounts**
> 3. Create a service account and download the JSON key
> 4. Share each Google Sheet with the service account's email address

---

## Environment Variables

| Variable | Used By | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Pipelines 1, 2 | Anthropic API key for Claude |
| `GITHUB_TOKEN` | Pipelines 1, 3 | GitHub personal access token (read scope) |
| `GOOGLE_SHEET_ID` | Pipeline 1 | Sheet ID for project submissions |
| `CASE_STUDY_SHEET_ID` | Pipeline 2 | Sheet ID for case study submissions |
| `STREAK_SHEET` | Pipeline 3 | Sheet ID for streak submissions |

> The Sheet ID is the long string between `/d/` and `/edit` in a Google Sheets URL.

---

## Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.91.1",
  "axios": "^1.15.2",
  "dotenv": "^17.4.2",
  "googleapis": "^171.4.0"
}
```

```bash
npm install
```

---

## Notes & Tips

- **Private or inaccessible repos** (Pipeline 1) are skipped automatically with a console log — no crash.
- **Missing or broken links** (Pipeline 2) — rows with no links are skipped; inaccessible links are logged as failed with no scores written.
- **Unsupported platforms** (Pipeline 3) — TryHackMe and Google Drive links are skipped gracefully.
- **Interrupted runs** — re-running any pipeline re-evaluates all rows from scratch. To avoid redundant API calls on restarts, add a check to skip rows where the final score column is already populated.
- **Changing the Claude model** — configured at the top of `sesd-eval.js` and `sesd-case-study-ai.js`. Default is `claude-sonnet-4-5`.
- **Customizing scoring criteria** — all evaluation logic is prompt-driven. Edit `prompt_new.js` (Pipeline 1) or `prompt-case-study.js` (Pipeline 2) to adjust rubric weights or output format without touching the runner logic.

---

## License

ISC © [JACOBIAN01](https://github.com/JACOBIAN01)