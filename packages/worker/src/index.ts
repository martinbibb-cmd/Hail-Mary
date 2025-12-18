export interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  // Configuration variables
  SARAH_MODEL?: string;
  SARAH_TEMPERATURE?: string;
  SARAH_MAX_TOKENS?: string;
  ROCKY_MODEL?: string;
  ROCKY_TEMPERATURE?: string;
  ROCKY_MAX_TOKENS?: string;
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

/**
 * Sarah request and response types
 * Sarah provides human-friendly explanations of Rocky's deterministic analysis
 */
type SarahExplainRequest = {
  rockyResult: RockyResponse;
  context: "customer" | "engineer";
};

type SarahExplainResponse = {
  message: string;
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

/**
 * Call Gemini for Rocky analysis
 * Uses configuration from env: ROCKY_MODEL, ROCKY_TEMPERATURE, ROCKY_MAX_TOKENS
 */
async function callGemini(env: Env, prompt: string): Promise<Omit<RockyResponse, "providerUsed">> {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  
  const model = env.ROCKY_MODEL || "gemini-1.5-pro";
  const temperature = parseFloat(env.ROCKY_TEMPERATURE || "0.2");
  const maxTokens = parseInt(env.ROCKY_MAX_TOKENS || "600", 10);
  
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
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

/**
 * Call OpenAI for Rocky analysis (fallback)
 * Uses ROCKY_TEMPERATURE and ROCKY_MAX_TOKENS, but hardcodes model (gpt-4o-mini)
 * as model names are provider-specific
 */
async function callOpenAI(env: Env, prompt: string): Promise<Omit<RockyResponse, "providerUsed">> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  
  const temperature = parseFloat(env.ROCKY_TEMPERATURE || "0.2");
  const maxTokens = parseInt(env.ROCKY_MAX_TOKENS || "600", 10);
  
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI failed: ${res.status}`);
  const data: any = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI: empty response");
  return JSON.parse(text);
}

/**
 * Call Anthropic for Rocky analysis (fallback)
 * Uses ROCKY_TEMPERATURE and ROCKY_MAX_TOKENS, but hardcodes model (claude-3-5-sonnet-latest)
 * as model names are provider-specific
 */
async function callAnthropic(env: Env, prompt: string): Promise<Omit<RockyResponse, "providerUsed">> {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
  
  const temperature = parseFloat(env.ROCKY_TEMPERATURE || "0.2");
  const maxTokens = parseInt(env.ROCKY_MAX_TOKENS || "600", 10);
  
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: maxTokens,
      temperature,
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

/**
 * Build prompt for Sarah to explain Rocky's results
 */
function buildSarahPrompt(request: SarahExplainRequest): string {
  const { rockyResult, context } = request;
  
  if (context === "customer") {
    return `You are SARAH, a friendly AI assistant explaining heating engineer findings to customers.

Rocky (our analysis engine) has analyzed a site visit and provided these findings:
- Summary: ${rockyResult.plainEnglishSummary}
- Technical Details: ${rockyResult.technicalRationale}
- Issues Found: ${rockyResult.blockers.join(", ") || "None"}

Your task:
Explain these findings to the customer in a warm, reassuring, and simple way.
- Use plain English (avoid jargon)
- Be honest but not alarming
- Keep it conversational and brief (2-3 sentences max)
- If there are blockers/issues, explain what happens next

Return ONLY the explanation text, nothing else.`;
  } else {
    // engineer context
    return `You are SARAH, an AI assistant helping heating engineers understand analysis results.

Rocky (our analysis engine) has analyzed a site visit and provided these findings:
- Summary: ${rockyResult.plainEnglishSummary}
- Technical Rationale: ${rockyResult.technicalRationale}
- Key Details: ${JSON.stringify(rockyResult.keyDetailsDelta, null, 2)}
- Checklist Updates: ${JSON.stringify(rockyResult.checklistDelta, null, 2)}
- Blockers: ${rockyResult.blockers.join(", ") || "None"}
- Provider Used: ${rockyResult.providerUsed}

Your task:
Provide a concise technical summary for the engineer.
- Highlight key actionable items
- Note any blockers that need attention
- Keep it brief (2-4 sentences)
- Use professional engineering terminology

Return ONLY the explanation text, nothing else.`;
  }
}

/**
 * Call Sarah to generate human-friendly explanation
 * Uses the same provider fallback as Rocky
 * 
 * Note: SARAH_MODEL only applies to Gemini. OpenAI and Anthropic fallbacks
 * use their own suitable models (gpt-4o-mini, claude-3-5-sonnet) since
 * model names are provider-specific and not interchangeable.
 */
async function explainWithSarah(env: Env, request: SarahExplainRequest): Promise<SarahExplainResponse> {
  const prompt = buildSarahPrompt(request);
  const model = env.SARAH_MODEL || "gemini-1.5-flash";
  const temperature = parseFloat(env.SARAH_TEMPERATURE || "0.3");
  const maxTokens = parseInt(env.SARAH_MAX_TOKENS || "500", 10);

  const errors: string[] = [];

  // Try Gemini first
  if (env.GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
        }
      );

      if (!res.ok) throw new Error(`Gemini failed: ${res.status}`);
      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini: empty response");

      return { message: text.trim() };
    } catch (e: any) {
      errors.push(`Gemini: ${String(e?.message ?? e)}`);
    }
  }

  // Try OpenAI fallback
  if (env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) throw new Error(`OpenAI failed: ${res.status}`);
      const data: any = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error("OpenAI: empty response");

      return { message: text.trim() };
    } catch (e: any) {
      errors.push(`OpenAI: ${String(e?.message ?? e)}`);
    }
  }

  // Try Anthropic fallback
  if (env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest",
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) throw new Error(`Anthropic failed: ${res.status}`);
      const data: any = await res.json();
      const text = data?.content?.[0]?.text;
      if (!text) throw new Error("Anthropic: empty response");

      return { message: text.trim() };
    } catch (e: any) {
      errors.push(`Anthropic: ${String(e?.message ?? e)}`);
    }
  }

  // If all providers fail, return a generic but safe response
  return {
    message:
      request.context === "customer"
        ? "Our analysis shows some findings from your visit. Your engineer will discuss these with you shortly."
        : `Analysis complete. Review Rocky's findings: ${request.rockyResult.plainEnglishSummary}. Errors: ${errors.join("; ")}`,
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

    if (req.method === "POST" && url.pathname === "/sarah/explain") {
      try {
        const body = await readJson<SarahExplainRequest>(req);
        if (!body?.rockyResult) {
          return json({ ok: false, error: "rockyResult is required" }, 400, cors);
        }
        if (!body?.context || !["customer", "engineer"].includes(body.context)) {
          return json({ ok: false, error: "context must be 'customer' or 'engineer'" }, 400, cors);
        }
        const result = await explainWithSarah(env, body);
        return json({ ok: true, ...result }, 200, cors);
      } catch (e: any) {
        return json({ ok: false, error: String(e?.message ?? e) }, 500, cors);
      }
    }

    return json({ ok: false, error: "Not found" }, 404, cors);
  },
};
