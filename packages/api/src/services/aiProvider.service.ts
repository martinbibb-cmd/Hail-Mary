/**
 * AI Provider Service
 * 
 * Handles communication with AI providers:
 * - Google Gemini for structured note generation (primary)
 * - OpenAI Whisper for audio transcription
 * - OpenAI GPT-4 for structured note generation (fallback)
 * - Anthropic Claude as secondary fallback
 * 
 * Provider priority: Gemini → OpenAI → Anthropic
 * 
 * Implements provider abstraction and fallback pattern
 */

import type {
  AIProviderConfig,
  DepotNotes,
  StructuredTranscriptResult,
} from '@hail-mary/shared';
import {
  depotTranscriptionService,
} from './atlasTranscription.service';

// ============================================
// AI API Response Types
// ============================================

interface OpenAIMessage {
  role: string;
  content: string;
}

interface OpenAIChoice {
  message: OpenAIMessage;
  index: number;
  finish_reason: string;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
}

interface AnthropicContentBlock {
  type: string;
  text: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiCandidate {
  content: {
    parts: Array<{ text?: string }>;
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

// ============================================
// Google Gemini Integration
// ============================================

/**
 * Call Google Gemini to structure transcript into depot notes
 */
export async function callGeminiForStructuring(
  transcript: string,
  config: AIProviderConfig,
  referenceMaterials?: string
): Promise<DepotNotes> {
  const systemPrompt = depotTranscriptionService.DEFAULT_ATLAS_NOTES_INSTRUCTIONS;
  
  let userPrompt = `Here is the transcript from a heating survey:\n\n${transcript}\n\n`;
  
  if (referenceMaterials) {
    userPrompt += `\nReference materials database:\n${referenceMaterials}\n\n`;
  }
  
  userPrompt += `Please structure this into depot notes following the sections described above. Return ONLY valid JSON in this format:
{
  "customer_summary": "...",
  "existing_system": "...",
  "property_details": "...",
  "radiators_emitters": "...",
  "pipework": "...",
  "flue_ventilation": "...",
  "hot_water": "...",
  "controls": "...",
  "electrical": "...",
  "gas_supply": "...",
  "water_supply": "...",
  "location_access": "...",
  "materials_parts": "...",
  "hazards_risks": "...",
  "customer_requests": "...",
  "follow_up_actions": "..."
}

Only include sections that have information. Use "Not discussed" if a required section has no information.`;

  const model = config.model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

  // Build request body with system instruction and user prompt
  const contents: GeminiContent[] = [
    {
      role: 'user',
      parts: [{ text: userPrompt }],
    },
  ];

  const body = {
    contents,
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: config.temperature || 0.3,
      maxOutputTokens: config.maxTokens || 2000,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: HTTP ${response.status} - ${errorText}`);
  }
  
  const data = await response.json() as GeminiResponse;
  
  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.code} - ${data.error.message}`);
  }
  
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('No candidates in Gemini response');
  }
  
  const candidate = data.candidates[0];
  const parts = candidate.content.parts;
  
  if (!parts || parts.length === 0 || !parts[0].text) {
    throw new Error('No text content in Gemini response');
  }
  
  const content = parts[0].text;
  
  try {
    const rawSections = JSON.parse(content);
    return depotTranscriptionService.normalizeSectionsFromModel(rawSections);
  } catch (parseError) {
    throw new Error(`Failed to parse Gemini response: ${parseError}`);
  }
}

// ============================================
// OpenAI Integration
// ============================================

/**
 * Transcribe audio using OpenAI Whisper
 */
export async function transcribeAudioWithWhisper(
  audioPath: string,
  apiKey: string,
  language: string = 'en'
): Promise<string> {
  const fs = await import('fs');
  const FormData = (await import('form-data')).default;
  
  // Read audio file
  const audioBuffer = fs.readFileSync(audioPath);
  
  // Create form data
  const form = new FormData();
  form.append('file', audioBuffer, {
    filename: 'audio.m4a',
    contentType: 'audio/mp4',
  });
  form.append('model', 'whisper-1');
  form.append('language', language);
  form.append('response_format', 'text');
  
  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error: ${error}`);
  }
  
  const transcriptText = await response.text();
  
  // Apply sanity checks
  return depotTranscriptionService.applyTranscriptionSanityChecks(transcriptText);
}

/**
 * Call OpenAI GPT-4 to structure transcript into depot notes
 */
export async function callOpenAIForStructuring(
  transcript: string,
  config: AIProviderConfig,
  referenceMaterials?: string
): Promise<DepotNotes> {
  const systemPrompt = depotTranscriptionService.DEFAULT_ATLAS_NOTES_INSTRUCTIONS;
  
  let userPrompt = `Here is the transcript from a heating survey:\n\n${transcript}\n\n`;
  
  if (referenceMaterials) {
    userPrompt += `\nReference materials database:\n${referenceMaterials}\n\n`;
  }
  
  userPrompt += `Please structure this into depot notes following the sections described above. Return ONLY valid JSON in this format:
{
  "customer_summary": "...",
  "existing_system": "...",
  "property_details": "...",
  "radiators_emitters": "...",
  "pipework": "...",
  "flue_ventilation": "...",
  "hot_water": "...",
  "controls": "...",
  "electrical": "...",
  "gas_supply": "...",
  "water_supply": "...",
  "location_access": "...",
  "materials_parts": "...",
  "hazards_risks": "...",
  "customer_requests": "...",
  "follow_up_actions": "..."
}

Only include sections that have information. Use "Not discussed" if a required section has no information.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: config.temperature || 0.3,
      max_tokens: config.maxTokens || 2000,
      response_format: { type: 'json_object' },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }
  
  const data = await response.json() as OpenAIResponse;
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in OpenAI response');
  }
  
  try {
    const rawSections = JSON.parse(content);
    return depotTranscriptionService.normalizeSectionsFromModel(rawSections);
  } catch (parseError) {
    throw new Error(`Failed to parse OpenAI response: ${parseError}`);
  }
}

/**
 * Call Anthropic Claude to structure transcript into depot notes
 */
export async function callAnthropicForStructuring(
  transcript: string,
  config: AIProviderConfig,
  referenceMaterials?: string
): Promise<DepotNotes> {
  const systemPrompt = depotTranscriptionService.DEFAULT_ATLAS_NOTES_INSTRUCTIONS;
  
  let userPrompt = `Here is the transcript from a heating survey:\n\n${transcript}\n\n`;
  
  if (referenceMaterials) {
    userPrompt += `\nReference materials database:\n${referenceMaterials}\n\n`;
  }
  
  userPrompt += `Please structure this into depot notes following the sections described above. Return ONLY valid JSON in this format:
{
  "customer_summary": "...",
  "existing_system": "...",
  "property_details": "...",
  "radiators_emitters": "...",
  "pipework": "...",
  "flue_ventilation": "...",
  "hot_water": "...",
  "controls": "...",
  "electrical": "...",
  "gas_supply": "...",
  "water_supply": "...",
  "location_access": "...",
  "materials_parts": "...",
  "hazards_risks": "...",
  "customer_requests": "...",
  "follow_up_actions": "..."
}

Only include sections that have information. Use "Not discussed" if a required section has no information.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-sonnet-20240229',
      max_tokens: config.maxTokens || 2000,
      temperature: config.temperature || 0.3,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }
  
  const data = await response.json() as AnthropicResponse;
  const content = data.content[0]?.text;
  
  if (!content) {
    throw new Error('No content in Anthropic response');
  }
  
  try {
    // Extract JSON from markdown code blocks if present
    let jsonContent = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }
    
    const rawSections = JSON.parse(jsonContent);
    return depotTranscriptionService.normalizeSectionsFromModel(rawSections);
  } catch (parseError) {
    throw new Error(`Failed to parse Anthropic response: ${parseError}`);
  }
}

/**
 * Call notes model with fallback pattern
 * Tries primary provider first, falls back to secondary if configured
 * Provider priority: Gemini → OpenAI → Anthropic
 */
export async function callNotesModel(
  transcript: string,
  primaryProvider: AIProviderConfig,
  fallbackProvider?: AIProviderConfig,
  referenceMaterials?: string
): Promise<DepotNotes> {
  try {
    // Try primary provider
    if (primaryProvider.provider === 'gemini') {
      return await callGeminiForStructuring(transcript, primaryProvider, referenceMaterials);
    } else if (primaryProvider.provider === 'openai') {
      return await callOpenAIForStructuring(transcript, primaryProvider, referenceMaterials);
    } else if (primaryProvider.provider === 'anthropic') {
      return await callAnthropicForStructuring(transcript, primaryProvider, referenceMaterials);
    } else {
      throw new Error(`Unknown AI provider: ${primaryProvider.provider}`);
    }
  } catch (primaryError) {
    console.error('Primary AI provider failed:', primaryError);
    
    // Try fallback if configured
    if (fallbackProvider) {
      console.log('Attempting fallback provider...');
      try {
        if (fallbackProvider.provider === 'gemini') {
          return await callGeminiForStructuring(transcript, fallbackProvider, referenceMaterials);
        } else if (fallbackProvider.provider === 'openai') {
          return await callOpenAIForStructuring(transcript, fallbackProvider, referenceMaterials);
        } else if (fallbackProvider.provider === 'anthropic') {
          return await callAnthropicForStructuring(transcript, fallbackProvider, referenceMaterials);
        } else {
          throw new Error(`Unknown fallback provider: ${fallbackProvider.provider}`);
        }
      } catch (fallbackError) {
        console.error('Fallback AI provider also failed:', fallbackError);
        throw new Error(`Both AI providers failed. Primary: ${primaryError}. Fallback: ${fallbackError}`);
      }
    }
    
    // No fallback configured
    throw primaryError;
  }
}

/**
 * Process a complete transcript into structured depot notes
 */
export async function processTranscriptToStructuredNotes(
  transcript: string,
  primaryProvider: AIProviderConfig,
  fallbackProvider?: AIProviderConfig,
  referenceMaterials?: string
): Promise<StructuredTranscriptResult> {
  // Apply sanity checks to transcript
  const cleanedTranscript = depotTranscriptionService.applyTranscriptionSanityChecks(transcript);
  
  // Call AI to structure the notes
  const depotNotes = await callNotesModel(
    cleanedTranscript,
    primaryProvider,
    fallbackProvider,
    referenceMaterials
  );
  
  // Extract materials
  const materials = depotTranscriptionService.extractMaterials(cleanedTranscript, depotNotes);
  
  // Detect missing information
  const missingInfo = depotTranscriptionService.detectMissingInfo(depotNotes);
  
  // Match checklist items
  const checklist = depotTranscriptionService.matchChecklistItems(cleanedTranscript, materials);
  
  // Calculate confidence (simple heuristic based on completeness)
  const totalSections = depotTranscriptionService.getAtlasSchema().sections.length;
  const filledSections = Object.keys(depotNotes).filter(key => {
    const value = depotNotes[key];
    return value && value.trim() !== '' && !value.toLowerCase().includes('not discussed');
  }).length;
  const confidence = Math.round((filledSections / totalSections) * 100) / 100;
  
  return {
    atlasNotes: depotNotes,
    depotNotes, // Legacy field for backwards compatibility
    materials,
    missingInfo,
    checklist,
    confidence,
  };
}

// ============================================
// Main Export
// ============================================

export const aiProviderService = {
  transcribeAudioWithWhisper,
  callGeminiForStructuring,
  callOpenAIForStructuring,
  callAnthropicForStructuring,
  callNotesModel,
  processTranscriptToStructuredNotes,
};
