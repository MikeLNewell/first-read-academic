# First Read v3

First Read is a lecturer-in-the-loop, AI-assisted initial review workspace for checking student submissions against the correct assessment brief and marking criteria.

## What changed in v3

First Read can now build an assessment profile directly from an existing DOCX or PDF assessment brief. In `New assessment profile`, choose `Choose brief`; the document is sent transiently to the authenticated extraction function, which uses the OpenAI API to populate the profile fields for lecturer review. Nothing is added to the annual library until `Save profile` is pressed.

The import is deliberately conservative:

- it extracts rather than rewrites the brief
- it keeps marking criteria, descriptors and weightings where present
- it leaves genuinely missing fields blank rather than inventing requirements
- the annual-library academic year already selected by the lecturer takes precedence over an old year embedded in a reused document
- importing a revised brief replaces the substantive brief/rubric fields, so stale criteria from an older version cannot silently remain
- the existing minimum-content validation remains in place before a profile can be saved
- the original assessment-brief file is not stored in Supabase by First Read

DOCX and PDF are supported up to 4 MB.

## Annual assessment library

Assessment profiles form a persistent annual library rather than living only in one browser.

The workflow is now:

`Academic year -> Unit -> Assessment -> Student submission -> Draft review`

The annual library supports:

- academic year, for example `2026/27`
- unit code and unit name
- multiple assessments per unit
- profile version numbers
- active and archived profiles
- duplication of an assessment into the next academic year
- editing the duplicated brief before it is used
- export/import of the complete assessment library as JSON
- migration of any old browser-only First Read profiles into the database

Assessment profiles are stored in Supabase. Student submissions are still processed transiently and are not written to Supabase or application storage.

## Architecture

Browser
-> authenticated Netlify site
-> Netlify Functions
-> Supabase for assessment profiles only
-> OpenAI API for submission review

Secrets remain server-side.

## Existing Netlify variables

Keep these variables from v1:

- `NETLIFY_APP_PASSWORD`
- `AUTH_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

The default model remains `gpt-5.6-terra`.

## Two new Netlify variables

The annual library also requires:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Both are read only by Netlify Functions. The secret key must never be placed in `public/`, browser JavaScript, GitHub or any client-side environment variable.

## Supabase setup

### 1. Create a Supabase project

Create a Supabase project specifically for First Read, or use an approved existing project.

### 2. Create the assessment table

Open the Supabase SQL Editor.

Open `supabase/schema.sql` from this repository, copy all of it into a new SQL query and run it once.

The script creates `public.assessment_profiles`, adds useful indexes, enables Row Level Security and deliberately creates no public browser policies.

### 3. Get the project URL

In Supabase, open the project API/settings area and copy the project URL. Add it to Netlify as:

`SUPABASE_URL`

This is not itself a secret, but it is fine to scope it to Functions.

### 4. Get the server-side secret key

In Supabase, open the project API/settings area and locate the server-side secret key.

Add it to Netlify as:

`SUPABASE_SECRET_KEY`

Treat this as highly sensitive. Mark it as a secret and scope it to Functions only.

### 5. Redeploy Netlify

After both variables have been added, trigger a fresh production deployment.

The Assessment Library should then load from Supabase.

## Recommended Netlify environment-variable configuration

### NETLIFY_APP_PASSWORD

- Secret: yes
- Scope: Functions
- Context: Production

### AUTH_SECRET

- Secret: yes
- Scope: Functions
- Context: Production

### OPENAI_API_KEY

- Secret: yes
- Scope: Functions
- Context: Production

### OPENAI_MODEL

- Secret: no
- Scope: All scopes is acceptable
- Value: `gpt-5.6-terra`

### SUPABASE_URL

- Secret: no
- Scope: Functions
- Context: Production

### SUPABASE_SECRET_KEY

- Secret: yes
- Scope: Functions
- Context: Production

## Updating the existing GitHub repository

Replace the project files with the contents of this v3 folder, but retain the repository's `.git` folder. No Supabase schema change and no new environment variables are required when upgrading from v2.

Then run:

```bash
git add .
git commit -m "Add assessment brief document import"
git push
```

Netlify should automatically create a new deployment from the push. Existing annual assessment profiles remain unchanged.

## Day-to-day annual workflow

At the start of a new academic year:

1. Open Assessment library.
2. Find last year's assessment.
3. Choose `Duplicate`.
4. Enter the new academic year, for example `2027/28`.
5. Open the copy and update the brief, rubric, word count or instructions as required.
6. Keep the old version available for reference, or archive it if you do not want it appearing in the normal library view.

When reviewing work:

1. Choose academic year.
2. Choose unit.
3. Choose assessment.
4. Upload the student's PDF, DOCX or TXT file.
5. Generate the draft review.
6. Edit and approve the feedback yourself.

## Student-file handling

The annual database stores assessment profiles only. It does not store student submissions.

A student file is:

- selected locally in the browser
- sent over HTTPS to an authenticated Netlify Function
- passed to the OpenAI API for that review request
- not written to the Supabase assessment table
- not written to browser localStorage by First Read
- not deliberately written to Netlify storage by the application

The original submission filename is replaced with a generic filename before model processing.

## Governance

This remains a technical prototype. Before using real identifiable student work, obtain the approvals required by your university, including any required DPIA, information-governance review, approved supplier/API configuration and student-facing transparency information.

The OpenAI request uses `store: false`, but that does not by itself establish institutional approval or zero provider retention.

## Local development

Copy `.env.example` to `.env` and provide development values:

```bash
cp .env.example .env
npm install
npm run dev
```

## Checks

Run:

```bash
npm run check
```

This syntax-checks the browser application and all Netlify Functions.
