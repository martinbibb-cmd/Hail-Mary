/**
 * Whisper Service
 *
 * Handles audio recording and transcription via OpenAI Whisper API.
 */

export interface WhisperTranscriptResult {
  text: string;
  success: boolean;
  error?: string;
}

/**
 * Upload audio blob to Whisper API and get transcript
 */
export async function transcribeWithWhisper(
  audioBlob: Blob,
  apiKey: string
): Promise<WhisperTranscriptResult> {
  try {
    // Create form data with audio file
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper API error:', errorText);
      return {
        text: '',
        success: false,
        error: `Whisper API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();

    return {
      text: result.text || '',
      success: true,
    };
  } catch (error) {
    console.error('Failed to transcribe with Whisper:', error);
    return {
      text: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Start recording audio using MediaRecorder
 */
export async function startAudioRecording(): Promise<{
  mediaRecorder: MediaRecorder;
  audioChunks: Blob[];
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    return { mediaRecorder, audioChunks };
  } catch (error) {
    console.error('Failed to start audio recording:', error);
    throw error;
  }
}

/**
 * Stop recording and return audio blob
 */
export function stopAudioRecording(
  mediaRecorder: MediaRecorder,
  audioChunks: Blob[]
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      try {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

        // Stop all tracks to release microphone
        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        resolve(audioBlob);
      } catch (error) {
        reject(error);
      }
    };

    mediaRecorder.stop();
  });
}
