First Read 504 timeout fix

Why this patch exists
---------------------
Netlify synchronous Functions have a fixed 60-second execution limit. A full student-script review using a reasoning model can legitimately take longer than that, which causes an HTTP 504 even when the OpenAI request itself is still processing.

What changes
------------
- /api/analyse now starts the OpenAI Responses API request in background mode and returns immediately with a response id.
- A new /api/review-status endpoint checks progress.
- The browser polls that endpoint until the structured review is ready.
- Student submissions are still not stored in Supabase or by First Read.
- The existing file-upload MIME fix is retained.
- Your assessment library and authentication setup are unchanged.

Privacy note
------------
OpenAI background mode temporarily retains response state so it can be polled. OpenAI documents this as roughly 10 minutes of application-state retention for background mode. This is separate from First Read's own storage, which still does not persist student submissions.

Install
-------
From the root of your existing first-read-academic repository:

unzip -o ~/Downloads/first-read-504-timeout-fix.zip -d .
git add .
git commit -m "Move student review to asynchronous background processing"
git push

Netlify should redeploy automatically.

No new Netlify environment variables or Supabase changes are required.
