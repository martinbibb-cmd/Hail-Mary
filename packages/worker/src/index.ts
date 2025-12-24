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

/**
 * Engineer analysis request type
 */
type EngineerAnalyseRequest = {
  mode: string;
  context: {
    property: { address: string; postcode: string };
    visit: { startedAt: string };
    transcripts: Array<{ text: string; occurredAt: string }>;
    notes: string[];
  };
  queries: string[];
  kbSources: Array<{
    sourceId: string;
    docId: string;
    title: string;
    ref: string;
    text: string;
  }>;
};

type EngineerAnalyseResponse = {
  summary: string;
  facts: Array<{
    text: string;
    citations: string[];
    confidence?: "high" | "medium" | "low";
    verified?: boolean;
  }>;
  questions: string[];
  concerns: string[];
};

/**
 * Customer summary request type
 */
type CustomerSummaryRequest = {
  tone: string;
  propertyAddress: string | null;
  engineer: {
    summary: string;
    facts: Array<{
      text: string;
      citations: Array<{ docId: string; title: string; ref: string }>;
      confidence?: "high" | "medium" | "low";
      verified?: boolean;
    }>;
    questions: string[];
    concerns: string[];
  };
};

type CustomerSummaryResponse = {
  title: string;
  summaryMarkdown: string;
};

/**
 * Sarah chat request type
 */
type SarahChatRequest = {
  visitContext: {
    property: Record<string, any>;
    visit: Record<string, any>;
    engineer: Record<string, any> | null;
    kbSources: Array<{
      sourceId: string;
      docId: string;
      title: string;
      ref: string;
      text: string;
    }>;
  };
  message: string;
  mode: "engineer_explain" | "visit_kb";
  useKnowledgeBase: boolean;
};

type SarahChatResponse = {
  reply: string;
  citations: Array<{ title: string; docId: string; ref: string }>;
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

/**
 * Analyze engineer context using LLM with KB integration
 */
async function analyseEngineer(env: Env, request: EngineerAnalyseRequest): Promise<EngineerAnalyseResponse> {
  const { mode, context, queries, kbSources } = request;

  const system = [
    "You are the Atlas Engineer. You produce auditable technical outputs for a site survey visit.",
    "",
    "You will be given:",
    "- Visit context (transcripts + notes)",
    "- Knowledge Base sources (technical docs) with source IDs (S1, S2, ...)",
    "",
    "Non-negotiable guardrails:",
    "- Do NOT invent clearances, distances, measurements, or compliance claims.",
    "- If a fact is not directly supported by at least one provided KB source, either OMIT it or mark it as:",
    '  "Unverified – site check required: <fact>"',
    "- Any fact that is NOT marked Unverified MUST include citations (one or more source IDs).",
    "- If a fact has ZERO citations, it MUST be marked verified=false and MUST start with \"Unverified\".",
    "- Use ONLY the provided source IDs in citations. Never invent doc IDs/titles/refs.",
    "",
    "Output must be STRICT JSON (no markdown) with keys:",
    '{ "summary": string, "facts": Array<{ "text": string, "citations": string[], "confidence"?: "high"|"medium"|"low", "verified"?: boolean }>, "questions": string[], "concerns": string[] }',
    "",
    "Facts guidance:",
    "- Each fact should be a single, checkable claim.",
    "- Prefer manufacturer instructions over generic guidance where possible.",
    "- If the model/installation details are missing, ask targeted questions rather than guessing.",
  ].join("\n");

  const kbBlock =
    kbSources.length > 0
      ? [
          "Knowledge Base sources (cite by source ID):",
          ...kbSources.map((s) => {
            const safe = String(s.text || "").replace(/\s+/g, " ").trim();
            const clipped = safe.length > 1200 ? `${safe.slice(0, 1200)}…` : safe;
            return `- [${s.sourceId}] docId=${s.docId} title="${s.title}" ref=${s.ref} text="${clipped}"`;
          }),
        ].join("\n")
      : "Knowledge Base sources: NONE_FOUND";

  const user = [
    `Mode: ${mode}`,
    "",
    "Visit context:",
    `Property: ${JSON.stringify(context.property)}`,
    `Visit: ${JSON.stringify(context.visit)}`,
    context.transcripts.length > 0 ? `Transcripts: ${JSON.stringify(context.transcripts)}` : "Transcripts: []",
    context.notes.length > 0 ? `Notes: ${JSON.stringify(context.notes)}` : "Notes: []",
    "",
    `Derived technical queries: ${JSON.stringify(queries)}`,
    "",
    kbBlock,
  ].join("\n");

  // Try OpenAI first
  if (env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.1,
          max_tokens: 900,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            summary: parsed.summary || `Engineer (${mode}): generated output`,
            facts: parsed.facts || [],
            questions: parsed.questions || [],
            concerns: parsed.concerns || [],
          };
        }
      }
    } catch (e: any) {
      console.error("Worker engineer OpenAI failed:", e);
    }
  }

  // Fallback: return safe output
  return {
    summary: `Engineer (${mode}): No AI key configured`,
    facts: [
      {
        text: `Unverified – site check required: Captured ${context.transcripts.length} transcript(s) and ${context.notes.length} note(s).`,
        citations: [],
        confidence: "low",
        verified: false,
      },
    ],
    questions: ["What is the exact boiler make/model and flue type/route?"],
    concerns: [],
  };
}

/**
 * Generate customer-friendly summary from engineer output
 */
async function generateCustomerSummary(env: Env, request: CustomerSummaryRequest): Promise<CustomerSummaryResponse> {
  const { tone, propertyAddress, engineer } = request;

  const system = [
    "You rewrite the provided Engineer output into a customer-friendly summary.",
    "",
    "Strict rules (non-negotiable):",
    "- You may ONLY use the provided Engineer output (summary/facts/questions/concerns) and the optional property address.",
    "- You MUST NOT introduce any new technical claims, measurements, model numbers, compliance assertions, or inferred site conditions.",
    "- If a detail is not explicitly present, omit it. Do not guess. Do not add \"common knowledge\".",
    "- Keep wording gentle and calm. Avoid alarmist language.",
    "- Never mention Knowledge Base, manuals, regulations, or citations.",
    "",
    "Output requirements:",
    "- Return STRICT JSON (no markdown wrapper) with keys: {\"title\": string, \"summaryMarkdown\": string}.",
    "- summaryMarkdown MUST be valid markdown and include exactly these sections in this order:",
    '  1) "## What we found"',
    '  2) "## What we recommend"',
    '  3) "## Next steps"',
    "- Use bullet lists where helpful.",
    "- Do not include any other headings before those sections (a short 1–2 line intro is ok).",
  ].join("\n");

  const user = [
    `Tone: ${tone}`,
    `Property address (optional): ${propertyAddress}`,
    `Engineer output (latest only): ${JSON.stringify({ engineer }, null, 2)}`,
  ].join("\n\n");

  const baseTitle = "Home heating survey summary";
  const title = propertyAddress ? `${baseTitle} — ${propertyAddress}` : baseTitle;

  // Try OpenAI first
  if (env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 900,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            title: parsed.title || title,
            summaryMarkdown: parsed.summaryMarkdown || "",
          };
        }
      }
    } catch (e: any) {
      console.error("Worker customer-summary OpenAI failed:", e);
    }
  }

  // Fallback: return template-based summary
  const factTexts = engineer.facts.map((f) => f.text).filter(Boolean).slice(0, 10);
  const questions = engineer.questions.slice(0, 10);
  const concerns = engineer.concerns.slice(0, 10);

  const summaryMarkdown = [
    propertyAddress ? `**Property:** ${propertyAddress}` : null,
    "",
    "## What we found",
    engineer.summary || "_No summary was provided in the latest Engineer output._",
    "",
    factTexts.length > 0
      ? `### Key points\n${factTexts.map((t) => `- ${t}`).join("\n")}`
      : "### Key points\n- _None listed in the Engineer output._",
    "",
    "## What we recommend",
    concerns.length > 0
      ? concerns.map((t) => `- ${t}`).join("\n")
      : "- _No concerns were listed in the Engineer output._",
    "",
    "## Next steps",
    questions.length > 0
      ? questions.map((t) => `- ${t}`).join("\n")
      : "- _No next steps were listed in the Engineer output._",
    "",
  ]
    .filter((x) => x !== null)
    .join("\n")
    .trim();

  return { title, summaryMarkdown };
}

/**
 * Chat with Sarah using visit context
 */
async function chatWithSarah(env: Env, request: SarahChatRequest): Promise<SarahChatResponse> {
  const { visitContext, message, mode, useKnowledgeBase } = request;

  const system = [
    mode === "engineer_explain"
      ? "You are Sarah. You explain the latest Engineer output in plain English."
      : "You are Sarah, a read-only assistant for a site survey visit.",
    "",
    mode === "engineer_explain"
      ? "You will be given ONE context: (A) Property summary + latest Engineer output."
      : "You will be given TWO separated contexts:\nA) Visit facts (property summary, latest engineer_output if any).\nB) Knowledge Base sources (technical docs).",
    "",
    "Behaviour rules:",
    ...(mode === "engineer_explain"
      ? [
          "- You may ONLY use the provided Engineer output and property summary.",
          "- You may NOT introduce new technical claims of any kind. Do not infer/assume details that are not explicitly present.",
          "- You may NOT invent measurements, model numbers, site conditions, or compliance assertions.",
          "- You may reference citations already attached to Engineer facts (docId/title/ref) but you may NOT invent sources.",
          "- If the user asks something outside the Engineer output, say what is missing and suggest running Engineer again or adding the missing info.",
        ]
      : [
          "- Treat Visit facts and KB facts separately; never mix them up.",
          "- You must NOT invent site-specific measurements, model numbers, site conditions, or compliance claims not present in Visit facts.",
        ]),
    "- You must NOT write timeline events or run Engineer (read-only).",
    "",
    mode === "engineer_explain"
      ? "Output format:\n- Return STRICT JSON (no markdown) with keys: {\"reply\": string}."
      : "Output format:\n- Return STRICT JSON (no markdown) with keys: {\"reply\": string, \"citations\": string[]}.\n- \"citations\" is a list of KB source IDs actually used (may be empty).",
  ].join("\n");

  const kbBlock =
    mode === "visit_kb" && useKnowledgeBase && visitContext.kbSources.length > 0
      ? [
          "Knowledge Base sources (use these for citations):",
          ...visitContext.kbSources.map((s) => {
            const safe = String(s.text || "").replace(/\s+/g, " ").trim();
            const clipped = safe.length > 1200 ? `${safe.slice(0, 1200)}…` : safe;
            return `- [${s.sourceId}] docId=${s.docId} title="${s.title}" ref=${s.ref} text="${clipped}"`;
          }),
        ].join("\n")
      : mode === "visit_kb"
        ? "Knowledge Base: DISABLED"
        : "Knowledge Base: DISABLED (engineer_explain mode)";

  const user = [
    "Visit context:",
    `Property summary: ${JSON.stringify(visitContext.property)}`,
    `Latest engineer_output (if any): ${JSON.stringify(visitContext.engineer)}`,
    ...(mode === "visit_kb" ? ["", kbBlock] : []),
    "",
    `User question: ${message}`,
  ].join("\n");

  // Try OpenAI first
  if (env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          const reply = parsed.reply || "";

          if (mode === "engineer_explain") {
            return { reply, citations: [] };
          }

          const citedIds = Array.isArray(parsed.citations) ? parsed.citations : [];
          const kbSourcesById = new Map(visitContext.kbSources.map((s) => [s.sourceId, s]));
          const citations = citedIds
            .map((id: string) => kbSourcesById.get(id))
            .filter(Boolean)
            .map((s: any) => ({ title: s.title, docId: s.docId, ref: s.ref }));

          return { reply, citations };
        }
      }
    } catch (e: any) {
      console.error("Worker sarah/chat OpenAI failed:", e);
    }
  }

  // Fallback
  return {
    reply:
      mode === "engineer_explain"
        ? "Run Engineer first so I have something to explain."
        : "I can't answer that right now — check worker secrets configuration.",
    citations: [],
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

    if (req.method === "POST" && url.pathname === "/engineer/analyse") {
      try {
        const body = await readJson<EngineerAnalyseRequest>(req);
        if (!body?.mode || !body?.context || !Array.isArray(body?.queries) || !Array.isArray(body?.kbSources)) {
          return json({ ok: false, error: "mode, context, queries, and kbSources are required" }, 400, cors);
        }
        const result = await analyseEngineer(env, body);
        return json({ ok: true, ...result }, 200, cors);
      } catch (e: any) {
        return json({ ok: false, error: String(e?.message ?? e) }, 500, cors);
      }
    }

    if (req.method === "POST" && url.pathname === "/customer-summary/generate") {
      try {
        const body = await readJson<CustomerSummaryRequest>(req);
        if (!body?.tone || !body?.engineer) {
          return json({ ok: false, error: "tone and engineer are required" }, 400, cors);
        }
        const result = await generateCustomerSummary(env, body);
        return json({ ok: true, ...result }, 200, cors);
      } catch (e: any) {
        return json({ ok: false, error: String(e?.message ?? e) }, 500, cors);
      }
    }

    if (req.method === "POST" && url.pathname === "/sarah/chat") {
      try {
        const body = await readJson<SarahChatRequest>(req);
        if (!body?.visitContext || !body?.message) {
          return json({ ok: false, error: "visitContext and message are required" }, 400, cors);
        }
        const result = await chatWithSarah(env, body);
        return json({ ok: true, ...result }, 200, cors);
      } catch (e: any) {
        return json({ ok: false, error: String(e?.message ?? e) }, 500, cors);
      }
    }

    return json({ ok: false, error: "Not found" }, 404, cors);
  },
};
