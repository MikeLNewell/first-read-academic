First Read v3 file-upload fix

Root cause fixed:
The browser intentionally sends the raw Base64 payload. The Netlify functions were forwarding that raw Base64 directly to OpenAI. OpenAI file inputs expect a Base64 data URL that includes the MIME type.

This patch changes both assessment-brief import and student-submission review to send:
  data:<mime-type>;base64,<payload>

Files included:
- netlify/functions/extract-assessment.mjs
- netlify/functions/analyse.mjs

Overlay this folder onto the root of the existing first-read-academic repository, then commit and push.
