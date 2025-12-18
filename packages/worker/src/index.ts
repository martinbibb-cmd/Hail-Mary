export interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  // Optional: restrict callers later
  // WORKER_SHARED_SECRET?: string;
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  // tighten later to your domains if you want
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
}

async function readJson<T>(req: Request): Promise<T> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error("Expected application/json");
  return (await req.json()) as T;
}

/**
 * Structured output shape Rocky returns to the PWA.
 * Keep it stable; you can expand fields later.
 */
type RockyResponse = {
  providerUsed: "gemini" | "openai" | "anthropic";
  plainEnglishSummary: string;
  technicalRationale: string;
  keyDetailsDelta: Record<string, any>;
  checklistDelta: Record<string, any>;
  blockers: string[];
};

type AnalyseRequest = {
  visitId: string;
  transcriptChunk: string;
  snapshot?: Record<string, any>;
};

function buildPrompt(payload: AnalyseRequest) {
  // "C" mode: technical + plain English
  return `
You are ROCKY, an engineering analysis engine for UK boiler surveys.
Return ONLY valid JSON matching this schema:
{
  "plainEnglishSummary": string,
  "technicalRationale": string,
  "keyDetailsDelta": object,
  "checklistDelta": object,
  "blockers": string[]
}

Context:
- visitId: ${payload.visitId}
- transcriptChunk: ${payload.transcriptChunk}
- snapshot: ${JSON.stringify(payload.snapshot ?? {}, null, 2)}

Rules:
- plainEnglishSummary must be customer-safe and short.
- technicalRationale should be concise but engineer-oriented.
- keyDetailsDelta: suggested updates for occupancy/property/current system/problems/proposed system.
- checklistDelta: suggested checklist item state changes.
- blockers: missing info needed to be confident.
`;
}

async function callGemini(env: Env, prompt: string): Promise<Omit<RockyResponse, "providerUsed">> {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  // Gemini API format varies by endpoint; this is a generic REST pattern.
  // If your Worker already uses a specific Gemini client, swap it in here.
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=" +
      env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini failed: ${res.status}`);
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: empty response");

  // Expect model to return JSON string
  return JSON.parse(text);
}

async function callOpenAI(env: Env, prompt: string): Promise<Omit<RockyResponse, "providerUsed">> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI failed: ${res.status}`);
  const data: any = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI: empty response");
  return JSON.parse(text);
}

async function callAnthropic(env: Env, prompt: string): Promise<Omit<RockyResponse, "providerUsed">> {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 600,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic failed: ${res.status}`);
  const data: any = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Anthropic: empty response");
  return JSON.parse(text);
}

async function analyse(env: Env, payload: AnalyseRequest): Promise<RockyResponse> {
  const prompt = buildPrompt(payload);

  const errors: string[] = [];

  // 1) Gemini default
  try {
    const out = await callGemini(env, prompt);
    return { providerUsed: "gemini", ...out };
  } catch (e: any) {
    errors.push(String(e?.message ?? e));
  }

  // 2) OpenAI fallback
  try {
    const out = await callOpenAI(env, prompt);
    return { providerUsed: "openai", ...out };
  } catch (e: any) {
    errors.push(String(e?.message ?? e));
  }

  // 3) Anthropic fallback
  try {
    const out = await callAnthropic(env, prompt);
    return { providerUsed: "anthropic", ...out };
  } catch (e: any) {
    errors.push(String(e?.message ?? e));
  }

  // If everything fails, return a SAFE, usable payload (no broken UI)
  return {
    providerUsed: "gemini",
    plainEnglishSummary: "Rocky is currently unavailable. You can continue in manual mode.",
    technicalRationale: "All providers failed. Check Worker secrets, quotas, and outbound access.",
    keyDetailsDelta: {},
    checklistDelta: {},
    blockers: errors.slice(0, 5),
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const cors = corsHeaders(req);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return json(
        {
          ok: true,
          providers: {
            gemini: Boolean(env.GEMINI_API_KEY),
            openai: Boolean(env.OPENAI_API_KEY),
            anthropic: Boolean(env.ANTHROPIC_API_KEY),
          },
        },
        200,
        cors
      );
    }

    if (req.method === "POST" && url.pathname === "/rocky/analyse") {
      try {
        const body = await readJson<AnalyseRequest>(req);
        if (!body?.visitId || !body?.transcriptChunk) {
          return json({ ok: false, error: "visitId and transcriptChunk required" }, 400, cors);
        }
        const result = await analyse(env, body);
        return json({ ok: true, ...result }, 200, cors);
      } catch (e: any) {
        return json({ ok: false, error: String(e?.message ?? e) }, 500, cors);
      }
    }

    return json({ ok: false, error: "Not found" }, 404, cors);
  },
};
