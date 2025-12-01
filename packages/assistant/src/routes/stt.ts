/**
 * STT Route - Speech-to-Text endpoint
 *
 * POST /stt
 * Stub implementation that echoes back dummy text.
 * Real Whisper/OpenAI integration can be added later.
 */

import { Router, Request, Response } from "express";
import type { ApiResponse, STTRequest, STTResponse } from "@hail-mary/shared";

const router = Router();

/**
 * POST /stt
 * Accepts audio (or placeholder request body for now).
 * Returns { text: "transcribed text here" }.
 */
router.post("/", (req: Request, res: Response) => {
  try {
    const body: STTRequest = req.body;

    // Stub implementation - in production this would call Whisper/OpenAI
    // For now, we return a placeholder or echo back a test message
    let transcribedText = "This is a stub transcription. Real STT coming soon.";

    // If audio was provided (even as a placeholder), acknowledge it
    if (body.audio) {
      transcribedText = `[STT stub] Received audio data (${body.audio.length} chars). Transcription pending.`;
    }

    const response: ApiResponse<STTResponse> = {
      success: true,
      data: {
        text: transcribedText,
      },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
