import OpenAI from "openai";
import { isAuthenticated, json } from "./_auth.mjs";

function safeStatus(value) {
  return ["queued", "in_progress", "completed", "failed", "cancelled", "incomplete"].includes(value)
    ? value
    : "in_progress";
}

export async function handler(event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });
  if (!isAuthenticated(event)) return json(401, { error: "Your session has expired. Please sign in again." });
  if (!process.env.OPENAI_API_KEY) return json(500, { error: "OPENAI_API_KEY is not configured." });

  const responseId = String(event.queryStringParameters?.id || "").trim();
  if (!/^resp_[A-Za-z0-9_-]+$/.test(responseId)) {
    return json(400, { error: "A valid review job identifier is required." });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.retrieve(responseId);
    const status = safeStatus(response.status);

    if (status === "queued" || status === "in_progress") {
      return json(202, { status });
    }

    if (status === "failed" || status === "cancelled" || status === "incomplete") {
      const detail =
        response?.error?.message ||
        response?.incomplete_details?.reason ||
        "The AI review did not complete successfully.";
      console.error("Background review ended without completion", {
        responseId,
        status,
        detail
      });
      return json(502, {
        status,
        error: "The AI review did not complete successfully. Please try again."
      });
    }

    if (!response.output_text) {
      return json(502, { status, error: "The model completed but returned no review text." });
    }

    let result;
    try {
      result = JSON.parse(response.output_text);
    } catch (error) {
      console.error("Could not parse completed review JSON", { responseId, error });
      return json(502, {
        status,
        error: "The AI review completed but its structured result could not be read."
      });
    }

    return json(200, {
      status: "completed",
      result,
      meta: {
        model: response.model || process.env.OPENAI_MODEL || "gpt-5.6-terra",
        generatedAt: new Date().toISOString(),
        storedByApp: false,
        processingMode: "background",
        usage: response.usage || null
      }
    });
  } catch (error) {
    console.error("Review status check failed", {
      responseId,
      status: error?.status,
      message: error?.message
    });

    if (error?.status === 404) {
      return json(404, {
        error: "This review job is no longer available. Please run the review again."
      });
    }

    if (error?.status === 429) {
      return json(429, {
        error: "OpenAI is temporarily rate limiting status checks. Please wait a moment."
      });
    }

    return json(500, {
      error: "The review status could not be checked. Please try again."
    });
  }
}
