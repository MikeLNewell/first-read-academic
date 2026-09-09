# First Read

A secure-by-design MVP for lecturer-in-the-loop, AI-assisted initial review of student submissions against a lecturer-supplied assessment brief and marking criteria.

## What this version does

- Password-protected workspace using a server-side Netlify Function and signed HttpOnly session cookie.
- Assessment profile library for unit code, assessment instructions, learning outcomes, rubric and lecturer guidance.
- Profiles are stored in the lecturer's browser localStorage in this MVP, not in a cloud database.
- PDF, DOCX and TXT submission upload up to 4 MB.
- Submission is passed directly through a Netlify Function to the OpenAI Responses API and is not written to a database or application storage.
- The original filename is not passed to the AI. It is renamed to `submission.pdf`, `submission.docx` or `submission.txt` before model processing.
- Structured feedback against criteria, strengths, development priorities and manual checks.
- Explicit prompt safeguards against automated marks, pass/fail decisions and AI-authorship allegations.
- Every feedback field is editable by the lecturer.
- Copy student-facing feedback, export a text report, or print/save as PDF.
- Export/import assessment profiles as JSON for backup.

## Important governance note

This is a technical prototype. Before processing real identifiable student work, obtain the approvals required by your university. Depending on institutional policy this may include a DPIA, information governance review, confirmation of the lawful basis for processing, approved supplier/API configuration, retention settings and student-facing transparency information.

The app sets `store: false` on the OpenAI Responses API request, but this does not itself replace institutional review or any OpenAI account-level data retention controls.

## Deploy to Netlify

### Option A: GitHub + Netlify

1. Create a private GitHub repository.
2. Put all files from this folder into the repository and push them.
3. In Netlify, choose **Add new project > Import an existing project** and connect the repository.
4. Netlify will detect `netlify.toml`. No build command is required.
5. Add the environment variables listed below.
6. Deploy.

### Option B: Netlify CLI

Node 22+ is recommended.

```bash
npm install
npx netlify login
npx netlify init
```

Add the environment variables in Netlify, then:

```bash
npx netlify deploy --prod
```

Note: because this site uses Netlify Functions, it is not a pure static drag-and-drop deployment.

## Required Netlify environment variables

In Netlify: **Site configuration > Environment variables**

- `OPENAI_API_KEY`: your server-side OpenAI API key.
- `NETLIFY_APP_PASSWORD`: a long unique password for the workspace.
- `AUTH_SECRET`: at least 32 random characters, preferably much longer.
- `OPENAI_MODEL`: optional. Defaults to `gpt-5.6-terra` to balance quality and cost.

Generate an auth secret locally, for example:

```bash
openssl rand -hex 32
```

Never place the API key, password or auth secret in `public/app.js`, GitHub, HTML or any browser-side file.

## Local development

Copy `.env.example` to `.env` and add development values:

```bash
cp .env.example .env
npm install
npm run dev
```

Netlify CLI will provide the local URL and run the Functions.

## Recommended first setup

Create one assessment profile and paste in:

1. The student-facing assessment brief.
2. Relevant learning outcomes.
3. The marking criteria or rubric.
4. Any additional instructions that students genuinely received.
5. A short description of your preferred feedback style.

Avoid adding hidden criteria or expectations that students were never given.

## Security model in this MVP

The password itself is checked only by the serverless login function. A signed, HttpOnly, SameSite=Strict cookie is used for a 12-hour session. The OpenAI API key remains server-side.

The HTML/JavaScript/CSS assets are public web assets. They contain no student information, assessment profiles or secrets. Assessment profiles are browser-local and the AI analysis endpoint will reject requests without a valid session cookie.

For a multi-user departmental deployment, replace the single workspace password with institutional SSO or a managed identity service and move assessment profiles to an access-controlled database.

## File-size limitation

This prototype limits uploads to 4 MB because the file is transported through a synchronous Netlify Function request as base64. If you routinely receive large dissertations with high-resolution images, the next version should use an approved temporary upload workflow or another controlled server-side ingestion route.

## Suggested phase-two features

- University SSO / Microsoft Entra ID authentication.
- Supabase or institutional database for centrally managed assessment profiles.
- DOCX feedback export using a university template.
- Cohort dashboard based only on lecturer-approved, de-identified themes.
- Rubric table parser for more explicit criterion mapping.
- Reference-verification workflow as a separate lecturer-triggered check.
- Batch workflow for multiple submissions, subject to governance approval.
- Audit log recording lecturer actions without retaining student submissions.

## OpenAI implementation

The server uses the OpenAI JavaScript SDK and Responses API with Structured Outputs. The default model is `gpt-5.6-terra`, configurable through `OPENAI_MODEL`.
