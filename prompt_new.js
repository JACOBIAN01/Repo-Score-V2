const file_identifier_prompt = (files, owner, repo) => `
You are a file classifier for a GitHub repository.

Repo files list:
${files.join("\n")}

GitHub base URL: https://github.com/${owner}/${repo}/blob/main/

Your task:
Map each of the following required documentation files to the BEST matching file from the repo list above.
Use flexible name matching based on intent and keyword — NOT exact filename or extension.

Required files to find and their accepted keyword patterns:
- idea.md        → keywords: idea, project-idea, about, overview
- useCaseDiagram.md  → keywords: use, usecase, use-case, usecasediagram, use_case
- sequenceDiagram.md → keywords: sequence, seq, seq-diagram, sequencediagram, sequence_diagram
- classDiagram.md    → keywords: class, class-diagram, classdiagram, class_diagram
- ErDiagram.md       → keywords: er, erd, database, database-diagram, erdiagram, er_diagram, db

Matching Rules:
1. Match ANY file extension — including .md, .jpg, .jpeg, .png, .svg, .pdf, .txt, .drawio, etc.
2. Match files inside subfolders too (e.g., docs/idea.md or assets/erd.jpg are valid)
3. Matching is case-insensitive (e.g., ERD.jpg, Erd.PNG, erd.md all match ErDiagram.md)
4. If multiple files match the same key, prefer: .md > .jpg > .png > other extensions
5. If no file matches a key's keywords, return null for that key
6. Return ONLY a raw JSON object — no explanation, no markdown, no code fences

Return format:
{
  "idea.md": "https://github.com/${owner}/${repo}/blob/main/..." or null,
  "useCaseDiagram.md": "https://github.com/${owner}/${repo}/blob/main/..." or null,
  "sequenceDiagram.md": "https://github.com/${owner}/${repo}/blob/main/..." or null,
  "classDiagram.md": "https://github.com/${owner}/${repo}/blob/main/..." or null,
  "ErDiagram.md": "https://github.com/${owner}/${repo}/blob/main/..." or null
}
`;


const content_eval_prompt = (fileMap, fileContents, readmeSnippet, allFiles,about={}) => {

  // Use idea.md OR README as the project context
  const projectContext = fileContents["idea.md"] || readmeSnippet.slice(0, 500);
  const aboutSection = `
## Repo About Section
- Description: ${about.description || "N/A"}
- Live URL: ${about.website || "N/A"}
`

  return `
You are a SESD final project evaluator.
Total Marks = 10

Evaluate the project using the following scoring system:

---

PROJECT CONTEXT (what this project is about):
${projectContext}

Use the above context to judge whether each diagram is RELEVANT to THIS specific project.
A diagram copied from the internet or mismatched with the project idea = 0 marks.

---

1. Documentation Completeness (MANDATORY) → 5 marks

Required files:
- idea.md (project scope + key features)
- useCaseDiagram.md
- sequenceDiagram.md (end-to-end main flow)
- classDiagram.md (major classes + relationships)
- ErDiagram.md (tables + relationships)

Scoring rule:
- Each file = 1 mark
- A file earns the mark ONLY if BOTH conditions are met:
  A) It has meaningful content (not empty, not "TBD", not placeholder)
     → For IMAGE files (.jpg, .png, .svg, .drawio, etc.): A valid accessible URL counts as meaningful content
  B) The content is RELEVANT to the project described in PROJECT CONTEXT above
     → For IMAGE files: The filename/path must semantically match the required diagram type
- Missing files = 0 marks
- Content that does not match the project domain = 0 marks

Flexible File Naming Rule:
File names do not need to match exactly. Similar or equivalent names are valid across ANY file extension (.md, .jpg, .png, .svg, .pdf, .drawio, etc.):
- idea.md/jpg/png → project-idea, about, overview (any extension)
- useCaseDiagram → use, usecase, use-case, usecasediagram (any extension)
- sequenceDiagram → sequence, seq, seq-diagram, sequencediagram (any extension)
- classDiagram → class, class-diagram, classdiagram (any extension)
- ErDiagram → er, erd, database-diagram, erdiagram (any extension)
Evaluation should be based on intent and content, not strict naming or extension.

Image File Handling Rules:
- If the file is an image (.jpg, .jpeg, .png, .gif, .svg, .webp, .drawio, .pdf):
  → Condition A (meaningful content) is satisfied if the URL is present and accessible
  → Condition B (relevance) is evaluated based on the filename and folder path semantics
  → Do NOT penalize for lack of text content in image files
- If the file is a text/markdown file (.md, .txt, etc.):
  → Both conditions must be evaluated based on actual text content as usual

Relevance Check Rules per file:
- idea.md: Describes THIS project's goals and features (not generic)
- useCaseDiagram.md: Actors and use cases match THIS project's users and features
- sequenceDiagram.md: Flow matches THIS project's core functionality
- classDiagram.md: Classes/entities match THIS project's domain (e.g. if hospital app → Patient, Doctor must exist)
- ErDiagram.md: Tables match THIS project's data requirements

File Contents to Evaluate:

${Object.entries(fileMap).map(([key, url]) => {
  const content = fileContents[key];
  const isImage = url && /\.(jpg|jpeg|png|gif|svg|webp|drawio|pdf)$/i.test(url);

  if (!url || (!content && !isImage)) return `### ${key}\nSTATUS: MISSING → 0 marks\n`;

  if (isImage) {
    return `### ${key}
URL: ${url}
FILE TYPE: Image/Binary (no text content expected)
EVALUATION BASIS: URL presence + filename semantic match
---`;
  }

  return `### ${key}
URL: ${url}
CONTENT (first 800 chars):
${content.slice(0, 800)}
---`;
}).join("\n")}

---


2. Backend Code Quality & OOP Implementation → 3 marks

Repo file structure:
${allFiles.join(", ")}

README (first 1500 chars):
${readmeSnippet.slice(0, 1500)}

Evaluate strictly:
- Codebase should reflect proper OOP principles (encapsulation, abstraction, modularity)
- Clear separation of concerns (controllers / services / repositories)
- Well-structured and maintainable backend code
- If backend structure is weak or not following OOP → deduct marks accordingly

Scoring:
- 3: Strong OOP, clear separation, well-structured
- 2: Partial OOP, some separation
- 1: Minimal structure, mostly procedural
- 0: No backend or completely unstructured

---

3. Frontend Quality → 2 marks

Evaluate strictly:
- UI structure and usability
- Proper integration with backend
- Component organization and clarity
- Check for a LIVE / HOSTED project link (in README or repo About section)
  - Strictly check ${aboutSection} for live or hosted project link. Mostly You will find link here. 
  - If NO hosted/live link is present → deduct 1 mark automatically
  - If present and working → full consideration

---

Strict Rules:
- Documentation scoring must be STRICT
- A file with content that does NOT match the project domain gets 0, even if the file exists
- Backend and frontend must be evaluated strictly
- Do NOT give full marks if project is incomplete

---

Return ONLY valid JSON (no markdown, no explanation):
{
  "final_score": number (0-10),
  "diagrams": number (0-5),
  "breakdown": {
    "diagram_dist": {
      "idea.md": 0 or 1,
      "useCaseDiagram.md": 0 or 1,
      "sequenceDiagram.md": 0 or 1,
      "classDiagram.md": 0 or 1,
      "ErDiagram.md": 0 or 1
    },
    "backend": number (0-3),
    "frontend": number (0-2)
  },
  "summary": "Very short feedback in bullet points only explaining strengths and where marks were deducted",
  "relevance_summary": {
    "idea.md": "one line: what project is about e.g. Hospital Management System with patients, doctors, appointments : relevant  / missing ",
    "useCaseDiagram.md": "one line: actors and use cases found e.g. Actors: Patient, Doctor | Use Cases: Book Appointment, View Record : relevant  / not relevant ",
    "sequenceDiagram.md": "one line: flow found e.g. Patient → BookAppointment → Doctor → Confirm : relevant  / missing ",
    "classDiagram.md": "one line: classes found e.g. Classes: Patient, Doctor, Appointment, Prescription : relevant  / mismatch ",
    "ErDiagram.md": "one line: tables found e.g. Tables: users, appointments, prescriptions : relevant  / missing "
  }
}
`;
};

export { file_identifier_prompt, content_eval_prompt };
