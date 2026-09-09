import { isAuthenticated, json } from "./_auth.mjs";

export async function handler(event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });
  return json(200, { authenticated: isAuthenticated(event) });
}
