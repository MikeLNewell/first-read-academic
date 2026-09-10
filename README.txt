First Read: separate developer password patch

This patch changes only netlify/functions/login.mjs.

After applying it, either of these Netlify environment variables can authenticate:
- NETLIFY_APP_PASSWORD
- NETLIFY_DEVELOPER_PASSWORD

The two passwords create the same authenticated session and therefore have the same permissions inside First Read.

Apply from the root of your existing first-read-academic repository:

unzip -o ~/Downloads/first-read-developer-password-patch.zip -d .
git add netlify/functions/login.mjs
git commit -m "Add separate developer login password"
git push

Then create NETLIFY_DEVELOPER_PASSWORD in Netlify:
- Contains secret values: Yes
- Scope: Functions
- Deploy context: Production
- Value: a separate password for the developer

After Netlify redeploys, either password will work.
