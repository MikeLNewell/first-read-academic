import crypto from "node:crypto";
import { isAuthenticated, json } from "./_auth.mjs";
import { supabaseRequest } from "./_supabase.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const YEAR_RE = /^\d{4}\/\d{2}$/;

function cleanText(value, max) {
  return String(value || "").trim().slice(0, max);
}

function toDb(input = {}, { existing = false } = {}) {
  const academicYear = cleanText(input.academicYear, 7);
  if (!YEAR_RE.test(academicYear)) throw new Error("Academic year must use the format 2026/27.");

  const row = {
    academic_year: academicYear,
    unit_code: cleanText(input.unitCode, 80),
    unit_name: cleanText(input.unitName, 180),
    assessment_name: cleanText(input.assessmentName, 180),
    academic_level: cleanText(input.academicLevel, 80),
    word_count: cleanText(input.wordCount, 80),
    feedback_style: cleanText(input.feedbackStyle, 4000),
    assessment_brief: cleanText(input.assessmentBrief, 30000),
    learning_outcomes: cleanText(input.learningOutcomes, 12000),
    rubric: cleanText(input.rubric, 30000),
    additional_instructions: cleanText(input.additionalInstructions, 12000),
    version: Math.min(99, Math.max(1, Number.parseInt(input.version, 10) || 1)),
    is_archived: Boolean(input.isArchived),
    updated_at: new Date().toISOString()
  };

  if (!row.unit_code || !row.unit_name || !row.assessment_name) throw new Error("Unit code, unit name and assessment name are required.");
  if (row.assessment_brief.length < 40) throw new Error("Please add a substantive assessment brief.");
  if (row.rubric.length < 20) throw new Error("Please add marking criteria or a rubric.");

  if (!existing) {
    row.id = crypto.randomUUID();
    row.created_at = new Date().toISOString();
    if (input.sourceProfileId && UUID_RE.test(input.sourceProfileId)) row.source_profile_id = input.sourceProfileId;
  }
  return row;
}

function fromDb(row) {
  return {
    id: row.id,
    academicYear: row.academic_year,
    unitCode: row.unit_code,
    unitName: row.unit_name,
    assessmentName: row.assessment_name,
    academicLevel: row.academic_level || "",
    wordCount: row.word_count || "",
    feedbackStyle: row.feedback_style || "",
    assessmentBrief: row.assessment_brief || "",
    learningOutcomes: row.learning_outcomes || "",
    rubric: row.rubric || "",
    additionalInstructions: row.additional_instructions || "",
    version: row.version || 1,
    isArchived: Boolean(row.is_archived),
    sourceProfileId: row.source_profile_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function databaseError(error) {
  if (error?.code === "SUPABASE_NOT_CONFIGURED") {
    return json(503, { error: "Assessment library database is not configured yet. Add SUPABASE_URL and SUPABASE_SECRET_KEY in Netlify." });
  }
  console.error("Assessment library error", error);
  return json(error?.status || 500, { error: "The assessment library could not be updated. Check the Netlify function log and Supabase configuration." });
}

export async function handler(event) {
  if (!isAuthenticated(event)) return json(401, { error: "Your session has expired. Please sign in again." });

  try {
    if (event.httpMethod === "GET") {
      const rows = await supabaseRequest("/rest/v1/assessment_profiles?select=*&order=academic_year.desc,unit_code.asc,assessment_name.asc,version.desc");
      return json(200, { profiles: (rows || []).map(fromDb) });
    }

    if (event.httpMethod === "POST") {
      const input = JSON.parse(event.body || "{}");
      const row = toDb(input);
      const created = await supabaseRequest("/rest/v1/assessment_profiles", { method: "POST", body: row, prefer: "return=representation" });
      return json(201, { profile: fromDb(created[0]) });
    }

    if (event.httpMethod === "PATCH") {
      const id = event.queryStringParameters?.id || "";
      if (!UUID_RE.test(id)) return json(400, { error: "Invalid assessment profile id." });
      const input = JSON.parse(event.body || "{}");
      const row = toDb(input, { existing: true });
      const updated = await supabaseRequest(`/rest/v1/assessment_profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: row, prefer: "return=representation" });
      if (!updated?.length) return json(404, { error: "Assessment profile not found." });
      return json(200, { profile: fromDb(updated[0]) });
    }

    if (event.httpMethod === "DELETE") {
      const id = event.queryStringParameters?.id || "";
      if (!UUID_RE.test(id)) return json(400, { error: "Invalid assessment profile id." });
      await supabaseRequest(`/rest/v1/assessment_profiles?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
      return json(200, { deleted: true });
    }

    return json(405, { error: "Method not allowed" });
  } catch (error) {
    if (error instanceof SyntaxError) return json(400, { error: "Invalid request body." });
    if (error?.message?.startsWith("Academic year") || error?.message?.startsWith("Unit code") || error?.message?.startsWith("Please add")) {
      return json(400, { error: error.message });
    }
    return databaseError(error);
  }
}
