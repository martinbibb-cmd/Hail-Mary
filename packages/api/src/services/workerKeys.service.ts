/**
 * Worker Keys Service
 * 
 * Provides helper functions to retrieve API keys for AI providers.
 * Currently retrieves keys from environment variables.
 * In the future, this could be extended to fetch keys from the Cloudflare Worker.
 * 
 * Note: Functions are async to support future integration with worker endpoints,
 * even though they currently perform synchronous operations.
 */

/**
 * Get OpenAI API key
 * @returns OpenAI API key from environment variables
 * @throws Error if no OpenAI API key is configured
 * 
 * Note: Function name uses 'Openai' (not 'OpenAI') to match existing imports in the codebase.
 * This is intentional and should not be changed to maintain backward compatibility.
 */
export async function getOpenaiApiKey(): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
  return apiKey;
}

/**
 * Get all AI provider API keys
 * @returns Object containing API keys for Gemini, OpenAI, and Anthropic
 */
export async function getApiKeys(): Promise<{
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}> {
  return {
    geminiApiKey: process.env.GEMINI_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  };
}
