/**
 * OpenAI Whisper STT Provider
 * 
 * Implements the SttProvider interface using OpenAI's Whisper API
 */

import type { SttProvider, SttResult } from './stt.service';
import { aiProviderService } from './aiProvider.service';

export class WhisperSttProvider implements SttProvider {
  name = 'whisper';
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for Whisper STT provider');
    }
    this.apiKey = apiKey;
  }

  async transcribe(audioPath: string, language: string = 'en'): Promise<SttResult> {
    try {
      // Convert language code (e.g., 'en-GB' -> 'en')
      const langCode = language.split('-')[0];
      
      const transcriptText = await aiProviderService.transcribeAudioWithWhisper(
        audioPath,
        this.apiKey,
        langCode
      );

      return {
        text: transcriptText,
        segments: [
          {
            startSeconds: 0,
            endSeconds: 30, // Default duration, actual duration from chunk metadata
            text: transcriptText,
            confidence: 0.95,
          },
        ],
      };
    } catch (error) {
      console.error('Whisper transcription error:', error);
      return {
        text: '',
        error: (error as Error).message,
      };
    }
  }
}
