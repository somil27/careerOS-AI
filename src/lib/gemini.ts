// Reusable Google Gemini client.
// Server-only: reads GEMINI_API_KEY from process.env — do not import from client code.
import { GoogleGenAI, Type, type Schema } from "@google/genai";

export const DEFAULT_MODEL = "gemini-2.5-flash";

let _client: GoogleGenAI | undefined;
function client(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

/**
 * Convert a permissive JSON-Schema-style object (the shape used by
 * OpenAI-style structured outputs) into the Gemini `responseSchema` shape.
 * Supports: string/number/boolean/array/object + enum + required.
 */
function toGeminiSchema(schema: any): Schema {
  if (!schema || typeof schema !== "object") return { type: Type.STRING };
  const t = String(schema.type ?? "string").toLowerCase();
  switch (t) {
    case "string": {
      const out: any = { type: Type.STRING };
      if (Array.isArray(schema.enum)) out.enum = schema.enum;
      return out;
    }
    case "number":
    case "integer":
      return { type: t === "integer" ? Type.INTEGER : Type.NUMBER };
    case "boolean":
      return { type: Type.BOOLEAN };
    case "array":
      return { type: Type.ARRAY, items: toGeminiSchema(schema.items ?? {}) };
    case "object": {
      const properties: Record<string, Schema> = {};
      for (const [k, v] of Object.entries(schema.properties ?? {})) {
        properties[k] = toGeminiSchema(v);
      }
      const out: Schema = {
        type: Type.OBJECT,
        properties,
      };
      if (Array.isArray(schema.required) && schema.required.length > 0) {
        (out as any).required = schema.required;
      }
      return out;
    }
    default:
      return { type: Type.STRING };
  }
}

/**
 * Call Gemini with a system prompt and user prompt. Optionally provide a
 * JSON schema for structured output. Returns the raw text response.
 */
export async function callGemini(
  system: string,
  user: string,
  schema?: object,
  options?: { model?: string; temperature?: number },
): Promise<string> {
  try {
    const response = await client().models.generateContent({
      model: options?.model ?? DEFAULT_MODEL,
      contents: user,
      config: {
        systemInstruction: system,
        temperature: options?.temperature ?? 0.7,
        ...(schema
          ? {
              responseMimeType: "application/json",
              responseSchema: toGeminiSchema(schema),
            }
          : {}),
      },
    });
    return response.text ?? "";
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    if (status === 429) throw new Error("Rate limit reached. Please try again shortly.");
    if (status === 402 || status === 403) throw new Error("Gemini API access denied. Check your GEMINI_API_KEY and billing.");
    throw new Error(`Gemini error: ${err?.message ?? String(err)}`);
  }
}

/** Parse Gemini JSON output, tolerating ```json fences. */
export function parseJSON<T>(s: string, fallback: T): T {
  try {
    const cleaned = s.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}
