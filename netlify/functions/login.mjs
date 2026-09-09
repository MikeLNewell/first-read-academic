import { createSessionCookie, json, safePasswordMatch } from "./_auth.mjs";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const expected = process.env.NETLIFY_APP_PASSWORD;
  if (!expected) return json(500, { error: "NETLIFY_APP_PASSWORD is not configured." });

  let password = "";
  try {
    password = JSON.parse(event.body || "{}").password || "";
  } catch {
    return json(400, { error: "Invalid request." });
  }

  if (!safePasswordMatch(password, expected)) {
    return json(401, { error: "Incorrect password." });
  }

  try {
    return json(200, { ok: true }, { "Set-Cookie": createSessionCookie() });
  } catch (error) {
    return json(500, { error: error.message });
  }
}
