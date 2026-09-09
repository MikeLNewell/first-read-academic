# Upgrade First Read v1 to v2

This upgrade adds a persistent annual assessment library.

## 1. Replace the project files

Copy the contents of this v2 folder into your existing local `first-read-academic` Git repository and replace files when prompted.

Do not delete the existing `.git` folder.

Then, from Terminal inside the existing repository:

```bash
git add .
git commit -m "Add persistent annual assessment library"
git push
```

Netlify will deploy the code automatically. The library will not work until Supabase is configured.

## 2. Create a Supabase project

Create a Supabase project for First Read.

## 3. Create the database table

In Supabase, open SQL Editor -> New query.

Copy everything from:

`supabase/schema.sql`

Paste it into the SQL editor and run it once.

## 4. Add two new Netlify variables

Add:

`SUPABASE_URL`

- Secret: no
- Scope: Functions
- Context: Production
- Value: your Supabase project URL

Add:

`SUPABASE_SECRET_KEY`

- Secret: yes
- Scope: Functions
- Context: Production
- Value: the server-side Supabase secret key beginning `sb_secret_...`

Keep the four existing variables unchanged:

- `NETLIFY_APP_PASSWORD`
- `AUTH_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## 5. Redeploy

Trigger a production deploy in Netlify after adding the two new variables.

## 6. Test

Log into First Read and open Assessment library.

Create a profile using academic year `2026/27`, then confirm it appears in the review screen under:

Academic year -> Unit -> Assessment

Use the Duplicate button to copy it into a future academic year.
