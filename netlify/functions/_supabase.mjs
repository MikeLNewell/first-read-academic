function config() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) {
    const error = new Error("Assessment library database is not configured.");
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }
  return { url, key };
}

export async function supabaseRequest(path, { method = "GET", body, prefer } = {}) {
  const { url, key } = config();
  const headers = {
    apikey: key,
    Accept: "application/json"
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = text; }
  }

  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || `Database request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}
