/**
 * Transcript Corrector
 *
 * Applies contextual corrections to speech-to-text output.
 * Keeps both raw and corrected versions for debugging.
 */

export interface TranscriptCorrection {
  raw: string;
  corrected: string;
  corrections: Array<{ from: string; to: string; position: number }>;
}

/**
 * Common contextual corrections for HVAC/heating domain
 */
const CONTEXTUAL_CORRECTIONS: Array<{ pattern: RegExp; replacement: string; context?: string }> = [
  // Flu/Flue corrections (only when referring to heating systems)
  { pattern: /\bflu\b/gi, replacement: 'flue', context: 'heating' },
  { pattern: /\bflew\b/gi, replacement: 'flue', context: 'heating' },
  { pattern: /\bflews\b/gi, replacement: 'flues', context: 'heating' },

  // Common HVAC misrecognitions
  { pattern: /\bboyla\b/gi, replacement: 'boiler' },
  { pattern: /\bboy la\b/gi, replacement: 'boiler' },
  { pattern: /\brady ate (?:or|er)\b/gi, replacement: 'radiator' },
  { pattern: /\brady eater\b/gi, replacement: 'radiator' },

  // Gas/heating terms
  { pattern: /\bgas safe\b/gi, replacement: 'Gas Safe' },
  { pattern: /\bcomby\b/gi, replacement: 'combi' },
  { pattern: /\bcombee\b/gi, replacement: 'combi' },

  // Manufacturer names
  { pattern: /\bworcester\s+bush\b/gi, replacement: 'Worcester Bosch' },
  { pattern: /\bvaliant\b/gi, replacement: 'Vaillant' },
  { pattern: /\bideol\b/gi, replacement: 'Ideal' },
];

/**
 * Determine if context suggests heating/HVAC domain
 */
function isHeatingContext(text: string): boolean {
  const heatingKeywords = [
    'boiler', 'radiator', 'heating', 'hot water', 'cylinder',
    'gas', 'central heating', 'combi', 'system', 'flue',
    'thermostat', 'controls', 'pipes', 'installation'
  ];

  const lowerText = text.toLowerCase();
  return heatingKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Apply contextual corrections to transcript
 */
export function correctTranscript(rawTranscript: string): TranscriptCorrection {
  let corrected = rawTranscript;
  const corrections: Array<{ from: string; to: string; position: number }> = [];

  const isHeating = isHeatingContext(rawTranscript);

  for (const rule of CONTEXTUAL_CORRECTIONS) {
    // Skip context-specific rules if context doesn't match
    if (rule.context === 'heating' && !isHeating) {
      continue;
    }

    let match: RegExpExecArray | null;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);

    while ((match = regex.exec(corrected)) !== null) {
      const original = match[0];
      const position = match.index;

      // Replace preserving case
      const replacement = preserveCase(original, rule.replacement);

      corrections.push({
        from: original,
        to: replacement,
        position,
      });

      // Apply replacement
      corrected = corrected.substring(0, position) +
                  replacement +
                  corrected.substring(position + original.length);

      // Reset regex to avoid infinite loop
      regex.lastIndex = position + replacement.length;
    }
  }

  return {
    raw: rawTranscript,
    corrected,
    corrections,
  };
}

/**
 * Preserve the case pattern of the original when applying replacement
 */
function preserveCase(original: string, replacement: string): string {
  // All uppercase
  if (original === original.toUpperCase()) {
    return replacement.toUpperCase();
  }

  // Title case (first letter uppercase)
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  }

  // All lowercase
  if (original === original.toLowerCase()) {
    return replacement.toLowerCase();
  }

  // Mixed case - return replacement as-is
  return replacement;
}

/**
 * Get correction summary for display
 */
export function getCorrectionSummary(correction: TranscriptCorrection): string {
  if (correction.corrections.length === 0) {
    return 'No corrections applied';
  }

  const summary = correction.corrections
    .map(c => `"${c.from}" → "${c.to}"`)
    .join(', ');

  return `${correction.corrections.length} correction(s): ${summary}`;
}
