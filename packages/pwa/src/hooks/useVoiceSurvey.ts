/**
 * useVoiceSurvey Hook
 * 
 * Custom React hook that integrates the SurveyEngine with Web Speech APIs
 * for voice-based survey interactions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SurveyEngine, SurveyNode } from '@hail-mary/surveyor-engine';
import type { 
  SpeechRecognition,
} from '../types/speech';

interface UseVoiceSurveyOptions {
  /** The survey schema to load */
  schema: SurveyNode[];
  /** Callback when survey is completed */
  onComplete?: (answers: Record<string, any>) => void;
  /** Language for speech synthesis and recognition */
  language?: string;
  /** Auto-start listening after speaking */
  autoListen?: boolean;
}

interface UseVoiceSurveyReturn {
  /** The current question node */
  currentQuestion: SurveyNode | null;
  /** Whether the system is listening for voice input */
  isListening: boolean;
  /** Whether the system is speaking */
  isSpeaking: boolean;
  /** Start the survey */
  startSurvey: () => void;
  /** Manually submit an answer (bypassing voice) */
  manualSubmit: (answer: any) => void;
  /** Stop listening */
  stopListening: () => void;
  /** Current survey state */
  surveyState: {
    started: boolean;
    completed: boolean;
    answers: Record<string, any>;
  };
  /** Error message if any */
  error: string | null;
}

/**
 * Hook to manage voice-based surveys using the SurveyEngine
 */
export function useVoiceSurvey(options: UseVoiceSurveyOptions): UseVoiceSurveyReturn {
  const { schema, onComplete, language = 'en-US', autoListen = true } = options;

  const [currentQuestion, setCurrentQuestion] = useState<SurveyNode | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<SurveyEngine | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Initialize the survey engine
  useEffect(() => {
    try {
      const engine = new SurveyEngine(schema);
      engineRef.current = engine;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load survey schema');
    }
  }, [schema]);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setError(`Speech recognition error: ${event.error}`);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleVoiceInput(transcript);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language]);

  /**
   * Speak the given text using Web Speech API
   */
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!synthRef.current) {
      setError('Speech synthesis is not supported in this browser');
      return;
    }

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEnd) {
        onEnd();
      }
    };

    utterance.onerror = (event) => {
      setIsSpeaking(false);
      setError(`Speech synthesis error: ${event.error}`);
    };

    synthRef.current.speak(utterance);
  }, [language]);

  /**
   * Start listening for voice input
   */
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not available');
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (err) {
      // Recognition might already be started, ignore the error
    }
  }, []);

  /**
   * Stop listening for voice input
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  /**
   * Extract answer value from voice input based on question type
   */
  const extractAnswerFromVoice = useCallback((text: string, inputType: string): any => {
    const lowerText = text.toLowerCase().trim();

    if (inputType === 'boolean') {
      // Check for affirmative responses
      if (/^(yes|yep|yeah|yup|sure|correct|true|affirmative)$/i.test(lowerText)) {
        return true;
      }
      // Check for negative responses
      if (/^(no|nope|nah|false|negative)$/i.test(lowerText)) {
        return false;
      }
      // Try to extract yes/no from longer phrases
      if (/\b(yes|yeah|yep|yup)\b/i.test(lowerText)) {
        return true;
      }
      if (/\b(no|nope|nah)\b/i.test(lowerText)) {
        return false;
      }
    }

    if (inputType === 'number') {
      // Extract numbers from text (e.g., "12 years" -> 12)
      const match = text.match(/\d+/);
      if (match) {
        return parseInt(match[0], 10);
      }
    }

    // For text type, return as-is
    return text;
  }, []);

  /**
   * Handle voice input and submit to the engine
   */
  const handleVoiceInput = useCallback((transcript: string) => {
    if (!engineRef.current || !currentQuestion) {
      return;
    }

    try {
      const answer = extractAnswerFromVoice(transcript, currentQuestion.inputType);
      const nextNode = engineRef.current.submitAnswer(answer);

      if (nextNode) {
        setCurrentQuestion(nextNode);
        // Speak the next question and optionally start listening again
        speak(nextNode.promptText, () => {
          if (autoListen) {
            setTimeout(() => startListening(), 500);
          }
        });
      } else {
        // Survey completed
        setCurrentQuestion(null);
        speak('Survey completed. Thank you!', () => {
          if (onComplete && engineRef.current) {
            onComplete(engineRef.current.getAnswers());
          }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process answer');
      // Retry listening after error
      setTimeout(() => startListening(), 1000);
    }
  }, [currentQuestion, extractAnswerFromVoice, speak, startListening, autoListen, onComplete]);

  /**
   * Manually submit an answer (bypass voice recognition)
   */
  const manualSubmit = useCallback((answer: any) => {
    if (!engineRef.current || !currentQuestion) {
      return;
    }

    try {
      const nextNode = engineRef.current.submitAnswer(answer);

      if (nextNode) {
        setCurrentQuestion(nextNode);
        speak(nextNode.promptText, () => {
          if (autoListen) {
            setTimeout(() => startListening(), 500);
          }
        });
      } else {
        // Survey completed
        setCurrentQuestion(null);
        speak('Survey completed. Thank you!', () => {
          if (onComplete && engineRef.current) {
            onComplete(engineRef.current.getAnswers());
          }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    }
  }, [currentQuestion, speak, startListening, autoListen, onComplete]);

  /**
   * Start the survey
   */
  const startSurvey = useCallback(() => {
    if (!engineRef.current) {
      setError('Survey engine not initialized');
      return;
    }

    try {
      const firstNode = engineRef.current.start();
      setCurrentQuestion(firstNode);
      setError(null);

      // Speak the first question
      speak(firstNode.promptText, () => {
        if (autoListen) {
          setTimeout(() => startListening(), 500);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start survey');
    }
  }, [speak, startListening, autoListen]);

  return {
    currentQuestion,
    isListening,
    isSpeaking,
    startSurvey,
    manualSubmit,
    stopListening,
    surveyState: {
      started: engineRef.current?.getState().currentNodeId !== null || engineRef.current?.getState().isComplete === true,
      completed: engineRef.current?.getState().isComplete ?? false,
      answers: engineRef.current?.getAnswers() ?? {},
    },
    error,
  };
}
