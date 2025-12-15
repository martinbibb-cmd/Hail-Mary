/**
 * Assistant Route - Message processing endpoint
 *
 * POST /assistant/message
 * Receives text from STT, uses LLM to process, and logs observations.
 */

import { Router, Request, Response } from "express";
import type {
  ApiResponse,
  AssistantMessageRequest,
  AssistantMessageResponse,
  AssistantAction,
} from "@hail-mary/shared";
import { logObservation } from "../tools";
import { callLLM, ToolDefinition } from "../llmClient";

const router = Router();

// Define available tools for the LLM
const tools: ToolDefinition[] = [
  {
    name: "log_observation",
    description: "Log an observation from the engineer's visit to the customer site. Use this to record notes, findings, measurements, or any relevant information about the job.",
    parameters: {
      type: "object",
      properties: {
        observation: {
          type: "string",
          description: "The observation text to log",
        },
      },
      required: ["observation"],
    },
  },
];

// System prompt for the assistant
const SYSTEM_PROMPT = `You are a helpful assistant for heating/boiler engineers during customer site visits. 
Your job is to help engineers document their observations and findings efficiently.

When an engineer tells you something about the job, use the log_observation tool to record it.
Be concise and professional in your responses.
If you're unsure what the engineer wants, ask a clarifying question.`;

/**
 * POST /assistant/message
 * Input:
 *   - sessionId (visit_session)
 *   - leadId
 *   - text (from STT)
 * Output:
 *   - assistantReply (what to show/say back)
 *   - actions (e.g. "log_observation", "ask_followup_question")
 */
router.post("/message", async (req: Request, res: Response) => {
  try {
    const body: AssistantMessageRequest = req.body;
    const { sessionId, leadId, text } = body;

    // Validate required fields
    if (!sessionId || !leadId || !text) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Missing required fields: sessionId, leadId, and text are required",
      };
      return res.status(400).json(response);
    }

    // Call the LLM with the user's message
    const llmResponse = await callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      tools,
    });

    const actions: AssistantAction[] = [];

    // Process any tool calls from the LLM
    if (llmResponse.toolCalls) {
      for (const toolCall of llmResponse.toolCalls) {
        if (toolCall.name === "log_observation") {
          const observationText = (toolCall.args.observation as string) || text;
          
          // Log the observation using the tool function
          const result = await logObservation({
            visitSessionId: sessionId,
            leadId,
            text: observationText,
          });

          if (result.success) {
            actions.push({
              type: "log_observation",
              text: observationText,
              observationId: result.observation?.id,
            });
          } else {
            console.error("Failed to log observation:", result.error);
          }
        }
      }
    }

    // Build the assistant response
    const assistantResponse: AssistantMessageResponse = {
      assistantReply: llmResponse.text || "Got it, I've logged that observation.",
      actions,
    };

    const response: ApiResponse<AssistantMessageResponse> = {
      success: true,
      data: assistantResponse,
    };

    res.json(response);
  } catch (error) {
    console.error("Assistant message error:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
