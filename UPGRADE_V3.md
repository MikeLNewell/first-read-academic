# Upgrade First Read v2 to v3

No database migration or new environment variable is required.

1. Copy all files from this v3 project over the files in your existing local `first-read-academic` repository. Keep the existing `.git` folder.
2. In Terminal, from the `first-read-academic` folder, run:

```bash
git add .
git commit -m "Add assessment brief document import"
git push
```

3. Netlify should redeploy automatically.
4. Open `Assessment library` -> `New assessment profile`.
5. Choose `Choose brief` and upload a DOCX or PDF up to 4 MB.
6. Review the extracted fields, especially the rubric and any extraction notes.
7. Press `Save profile`. The existing substantive-brief and rubric validation still applies.

The imported source document is processed for extraction but is not stored in Supabase by First Read.
