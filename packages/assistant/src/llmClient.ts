/**
 * LLM Client Module
 * 
 * Provides a unified interface to call LLM APIs.
 * Currently implements the Gemini REST API (JSON interface).
 */

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: { type: string };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface LLMResponse {
  text: string;
  toolCalls?: ToolCall[];
}

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string } | { functionCall: { name: string; args: Record<string, unknown> } }>;
}

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface GeminiCandidate {
  content: {
    parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }>;
    role: string;
  };
  finishReason: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Calls the Gemini LLM API with the given messages and optional tools.
 * 
 * @param options.messages - Array of conversation messages
 * @param options.tools - Optional array of tool definitions for function calling
 * @returns LLM response with text and optional tool calls
 */
export async function callLLM(options: {
  messages: Message[];
  tools?: ToolDefinition[];
}): Promise<LLMResponse> {
  const { messages, tools } = options;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set. LLM functionality is unavailable.");
    return {
      text: "I'm sorry, but the AI assistant is not configured. Please contact the administrator.",
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Convert messages to Gemini format
  const contents: GeminiContent[] = [];
  let systemInstruction: string | undefined;

  for (const message of messages) {
    if (message.role === "system") {
      // Gemini uses system_instruction at the top level
      systemInstruction = message.content;
    } else {
      contents.push({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      });
    }
  }

  // Build request body
  const body: Record<string, unknown> = {
    contents,
  };

  // Add system instruction if present
  if (systemInstruction) {
    body.system_instruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  // Add tools if present
  if (tools && tools.length > 0) {
    const functionDeclarations: GeminiFunctionDeclaration[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    }));

    body.tools = [{ function_declarations: functionDeclarations }];
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: HTTP ${response.status}`, errorText);
      return {
        text: "I'm sorry, I encountered an error processing your request. Please try again later.",
      };
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.error) {
      console.error(`Gemini API error: ${data.error.code} - ${data.error.message}`);
      return {
        text: "I'm sorry, I encountered an error processing your request. Please try again later.",
      };
    }

    if (!data.candidates || data.candidates.length === 0) {
      console.error("Gemini API returned no candidates");
      return {
        text: "I'm sorry, I couldn't generate a response. Please try again.",
      };
    }

    const candidate = data.candidates[0];
    const parts = candidate.content.parts;

    // Extract text and tool calls from the response
    let text = "";
    const toolCalls: ToolCall[] = [];

    for (const part of parts) {
      if (part.text) {
        text += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args,
        });
      }
    }

    return {
      text: text.trim(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  } catch (error) {
    console.error("Failed to call Gemini API:", error);
    return {
      text: "I'm sorry, I encountered an error connecting to the AI service. Please try again later.",
    };
  }
}
