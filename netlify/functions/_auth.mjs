import crypto from "node:crypto";

const COOKIE_NAME = "first_read_session";
const SESSION_SECONDS = 12 * 60 * 60;

function secret() {
  const value = process.env.AUTH_SECRET || "";
  if (value.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters long.");
  }
  return value;
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function safePasswordMatch(candidate, expected) {
  const a = crypto.createHash("sha256").update(String(candidate || "")).digest();
  const b = crypto.createHash("sha256").update(String(expected || "")).digest();
  return crypto.timingSafeEqual(a, b);
}

export function createSessionCookie() {
  const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS });
  const encoded = b64url(payload);
  const token = `${encoded}.${sign(encoded)}`;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        return idx === -1 ? [part, ""] : [part.slice(0, idx), part.slice(idx + 1)];
      })
  );
}

export function isAuthenticated(event) {
  try {
    const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");
    const token = cookies[COOKIE_NAME];
    if (!token) return false;

    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return false;

    const expected = sign(encoded);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    },
    body: JSON.stringify(body)
  };
}
