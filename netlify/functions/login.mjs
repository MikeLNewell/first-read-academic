import { createSessionCookie, json, safePasswordMatch } from "./_auth.mjs";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const primaryPassword = process.env.NETLIFY_APP_PASSWORD || "";
  const developerPassword = process.env.NETLIFY_DEVELOPER_PASSWORD || "";

  const acceptedPasswords = [primaryPassword, developerPassword].filter(Boolean);

  if (acceptedPasswords.length === 0) {
    return json(500, {
      error: "No application password is configured. Add NETLIFY_APP_PASSWORD in Netlify."
    });
  }

  let password = "";
  try {
    password = JSON.parse(event.body || "{}").password || "";
  } catch {
    return json(400, { error: "Invalid request." });
  }

  const passwordAccepted = acceptedPasswords
    .map((expected) => safePasswordMatch(password, expected))
    .some(Boolean);

  if (!passwordAccepted) {
    return json(401, { error: "Incorrect password." });
  }

  try {
    return json(200, { ok: true }, { "Set-Cookie": createSessionCookie() });
  } catch (error) {
    return json(500, { error: error.message });
  }
}
