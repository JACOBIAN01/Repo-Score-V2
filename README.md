# SESD Project Evaluator

An automated grading tool that evaluates student GitHub repositories for SESD final projects. It reads submission data from a Google Sheet, analyzes each repo using the Anthropic Claude API, and writes scores back to the sheet — all hands-free.

---

## How It Works

1. Reads student submissions from a Google Sheet (name, repo URL, batch, lab)
2. Fetches repo metadata, README, and file list from GitHub
3. Uses Claude to identify required documentation files (idea, use case, sequence, class, ER diagrams)
4. Fetches file contents and evaluates them for quality and project relevance
5. Scores each student out of 10 and writes results back to the sheet

---

## Scoring Breakdown

| Component | Marks |
|---|---|
| Documentation (5 required diagrams) | 5 |
| Backend code quality & OOP | 3 |
| Frontend quality + live link | 2 |
| **Total** | **10** |

Each diagram earns 1 mark only if it has meaningful content **and** is relevant to the student's specific project.

---

## Project Structure

```
.
├── index.js          # Main runner
├── prompt_new.js     # LLM prompts (file identifier + evaluator)
├── credentials.json  # Google service account key (not committed)
├── .env              # Environment variables (not committed)
└── package.json
```

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/your-org/sesd-evaluator
cd sesd-evaluator
npm install
```

### 2. Configure environment variables

Create a `.env` file in the root:

```env
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
GOOGLE_SHEET_ID=your_google_sheet_id
```

### 3. Add Google credentials

Place your Google service account key file as `credentials.json` in the root directory.  
The service account needs **Editor** access to the target Google Sheet.

> Get a service account key from [Google Cloud Console](https://console.cloud.google.com/) → IAM & Admin → Service Accounts.

### 4. Google Sheet format

The sheet must be named `Form responses 1` with the following columns:

| Col | Field |
|---|---|
| A | Timestamp |
| B | Email address |
| C | Name |
| D | URN |
| E | ADYPU Email |
| F | Batch |
| G | Lab |
| H | GitHub repo URL |
| I–R | ← scores written here by the script |

Output columns written by the evaluator:

| Col | Content |
|---|---|
| I | idea.md score (0/1) |
| J | useCaseDiagram score (0/1) |
| K | sequenceDiagram score (0/1) |
| L | classDiagram score (0/1) |
| M | ErDiagram score (0/1) |
| N | Backend score (0–3) |
| O | Frontend score (0–2) |
| P | Final score (0–10) |
| Q | Summary feedback |
| R | File-by-file relevance justification |

---

## Running

```bash
node index.js
```

The script processes all rows and logs progress to the console. A 15-second delay is applied between students to stay within Anthropic API rate limits (~4 students/min).

**Expected run time for 441 students: ~110 minutes.**

---

## Rate Limits

| Limit | Value | Usage |
|---|---|---|
| Requests per minute (RPM) | 50 | ~8 req/min (safe) |
| Tokens per minute (TPM) | 40,000 | ~24,000/min (safe) |
| API calls per student | 2 | identify + evaluate |
| Delay between students | 15 seconds | configurable in `index.js` |

To adjust the delay, change the value in `index.js`:

```js
await delay(15000); // milliseconds
```

---

## Required Diagrams

The evaluator looks for these files (flexible name + extension matching):

| Key | Accepted names | Extensions |
|---|---|---|
| `idea.md` | idea, project-idea, about, overview | `.md`, `.txt`, `.pdf`, etc. |
| `useCaseDiagram.md` | usecase, use-case, usecasediagram | `.md`, `.jpg`, `.png`, `.svg`, etc. |
| `sequenceDiagram.md` | sequence, seq, seq-diagram | `.md`, `.jpg`, `.png`, `.drawio`, etc. |
| `classDiagram.md` | class, class-diagram, classdiagram | `.md`, `.jpg`, `.png`, `.svg`, etc. |
| `ErDiagram.md` | er, erd, database, erdiagram | `.md`, `.jpg`, `.png`, `.drawio`, etc. |

Image files (`.jpg`, `.png`, `.svg`, `.drawio`) are accepted — a valid accessible URL counts as meaningful content. Relevance is judged by filename and folder path semantics.

---

## Dependencies

```json
"@anthropic-ai/sdk": "^0.39.0",
"axios": "^1.x",
"dotenv": "^16.x",
"googleapis": "^140.x"
```

Install with:

```bash
npm install
```

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `GITHUB_TOKEN` | GitHub personal access token (read-only scope sufficient) |
| `GOOGLE_SHEET_ID` | ID from the Google Sheet URL |

---

## Notes

- Repos that are private or inaccessible are skipped automatically with a log message
- If the script is interrupted, re-running it will re-evaluate all rows — add a column check to skip already-scored rows for faster restarts
- The Claude model used is `claude-sonnet-4-5` — change in `index.js` if needed
- All evaluation logic is prompt-driven — edit `prompt_new.js` to adjust scoring criteria

---

## License

MIT
