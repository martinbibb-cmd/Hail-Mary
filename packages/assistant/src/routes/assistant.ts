/**
 * Assistant Route - Message processing endpoint
 *
 * POST /assistant/message
 * Receives text from STT and logs observations.
 */

import { Router, Request, Response } from "express";
import type {
  ApiResponse,
  AssistantMessageRequest,
  AssistantMessageResponse,
} from "@hail-mary/shared";
import { logObservation } from "../tools";

const router = Router();

/**
 * POST /assistant/message
 * Input:
 *   - sessionId (visit_session)
 *   - customerId
 *   - text (from STT)
 * Output:
 *   - assistantReply (what to show/say back)
 *   - actions (e.g. "log_observation", "ask_followup_question")
 */
router.post("/message", async (req: Request, res: Response) => {
  try {
    const body: AssistantMessageRequest = req.body;
    const { sessionId, customerId, text } = body;

    // Validate required fields
    if (!sessionId || !customerId || !text) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Missing required fields: sessionId, customerId, and text are required",
      };
      return res.status(400).json(response);
    }

    // Log the observation using the tool function
    const result = await logObservation({
      visitSessionId: sessionId,
      customerId,
      text,
    });

    if (!result.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: result.error || "Failed to log observation",
      };
      return res.status(500).json(response);
    }

    // Build the assistant response
    const assistantResponse: AssistantMessageResponse = {
      assistantReply: "Got it, I've logged that observation.",
      actions: [
        {
          type: "log_observation",
          text: text,
          observationId: result.observation?.id,
        },
      ],
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
