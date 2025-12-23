/**
 * Sarah Explanation Layer Service
 * 
 * Consumes Rocky's facts and generates human-readable explanations.
 * MAY use LLM for tone and clarity, but MUST NOT add new technical claims.
 * 
 * Architectural Rule: Rocky decides. Sarah explains.
 */

import type {
  SarahExplainRequest,
  SarahProcessResult,
  SarahExplanation,
  SarahConfig,
  SarahAudience,
  SarahTone,
  RockyFacts,
} from '@hail-mary/shared';

// ============================================
// Sarah Configuration
// ============================================

const SARAH_CONFIG: SarahConfig = {
  engineVersion: '1.0.0',
  
  audienceTemplates: {
    customer: {
      systemPrompt: 'You are explaining heating survey findings to a homeowner. Be clear, friendly, and avoid jargon.',
      disclaimerTemplate: 'This explanation is based on facts gathered during the survey.',
    },
    engineer: {
      systemPrompt: 'You are explaining survey findings to a heating engineer. Be precise and technical.',
      disclaimerTemplate: 'Based on survey facts. Verify on site before installation.',
    },
    surveyor: {
      systemPrompt: 'You are explaining survey findings to a survey team member. Be practical and action-focused.',
      disclaimerTemplate: 'Survey fact summary. Update as needed based on site conditions.',
    },
    manager: {
      systemPrompt: 'You are explaining survey findings to a project manager. Focus on overview and implications.',
      disclaimerTemplate: 'Summary based on survey facts collected on site.',
    },
    admin: {
      systemPrompt: 'You are explaining survey findings to office admin. Focus on administrative aspects.',
      disclaimerTemplate: 'Administrative summary based on survey facts.',
    },
  },
  
  toneGuidelines: {
    professional: 'Maintain a formal, business-like tone.',
    friendly: 'Use a warm, approachable tone while remaining professional.',
    technical: 'Use precise, detailed technical language.',
    simple: 'Use simple, easy-to-understand language.',
    urgent: 'Use action-focused language emphasizing next steps.',
  },
  
  safetyRules: {
    prohibitedPhrases: [
      'I recommend',
      'You should',
      'It would be best to',
      'I suggest',
      'In my opinion',
      'Based on my experience',
    ],
    requiredDisclaimer: 'Based on survey facts',
    maxDeviationFromFacts: 20, // 20% interpretation allowed for tone/clarity
  },
};

// ============================================
// Sarah Core Functions (Template-based, no LLM for now)
// ============================================

/**
 * Generate explanation for customer audience
 */
function explainForCustomer(rockyFacts: RockyFacts, tone: SarahTone): SarahExplanation['sections'] {
  const facts = rockyFacts?.facts ?? {};
  
  const summary = generateCustomerSummary(facts, tone);
  const systemAssessment = generateCustomerSystemAssessment(facts, tone);
  const nextStepsGuidance = generateCustomerNextSteps(facts, tone);
  
  return {
    summary,
    systemAssessment,
    nextStepsGuidance,
  };
}

function generateCustomerSummary(facts: RockyFacts['facts'], tone: SarahTone): string {
  const friendly = tone === 'friendly' || tone === 'simple';
  
  let summary = friendly 
    ? "Here's what we found during your survey:\n\n"
    : "Survey findings summary:\n\n";
  
  if (facts.property?.type) {
    summary += `Your ${facts.property.type}`;
    if (facts.property.bedrooms) {
      summary += ` has ${facts.property.bedrooms} bedroom${facts.property.bedrooms > 1 ? 's' : ''}`;
    }
    summary += '.\n';
  }
  
  if (facts.existingSystem?.systemType) {
    summary += `Your current heating system is a ${facts.existingSystem.systemType} boiler`;
    if (facts.existingSystem.boilerAge) {
      summary += `, approximately ${facts.existingSystem.boilerAge} years old`;
    }
    summary += '.\n';
  }
  
  if (facts.hazards && facts.hazards.length > 0) {
    const highHazards = facts.hazards.filter(h => h.severity === 'high');
    if (highHazards.length > 0) {
      summary += `\nImportant: ${highHazards.map(h => h.type).join(', ')} ${highHazards.length > 1 ? 'were' : 'was'} identified.\n`;
    }
  }
  
  return summary;
}

function generateCustomerSystemAssessment(facts: RockyFacts['facts'], tone: SarahTone): string {
  const friendly = tone === 'friendly' || tone === 'simple';
  
  let assessment = friendly
    ? "About your current system:\n\n"
    : "Current system details:\n\n";
  
  if (facts.existingSystem) {
    if (facts.existingSystem.boilerMake || facts.existingSystem.boilerModel) {
      assessment += `Boiler: ${facts.existingSystem.boilerMake || ''} ${facts.existingSystem.boilerModel || ''}\n`;
    }
    
    if (facts.existingSystem.condition) {
      assessment += `Condition: ${facts.existingSystem.condition}\n`;
    }
    
    if (facts.existingSystem.fuelType) {
      assessment += `Fuel type: ${facts.existingSystem.fuelType}\n`;
    }
  }
  
  if (facts.measurements) {
    assessment += '\nKey measurements:\n';
    if (facts.measurements.pipeSize) {
      assessment += `- Pipe size: ${facts.measurements.pipeSize}\n`;
    }
    if (facts.measurements.radiatorCount) {
      assessment += `- Radiators: ${facts.measurements.radiatorCount}\n`;
    }
    if (facts.measurements.mainFuseRating) {
      assessment += `- Main fuse: ${facts.measurements.mainFuseRating}A\n`;
    }
  }
  
  return assessment;
}

function generateCustomerNextSteps(facts: RockyFacts['facts'], tone: SarahTone): string {
  const friendly = tone === 'friendly' || tone === 'simple';
  
  let nextSteps = friendly
    ? "What happens next:\n\n"
    : "Next steps:\n\n";
  
  if (facts.requiredActions && facts.requiredActions.length > 0) {
    const critical = facts.requiredActions.filter(a => a.priority === 'critical');
    const important = facts.requiredActions.filter(a => a.priority === 'important');
    
    if (critical.length > 0) {
      nextSteps += 'Priority actions:\n';
      critical.forEach(a => {
        nextSteps += `- ${a.action}\n`;
      });
    }
    
    if (important.length > 0) {
      nextSteps += '\nOther actions:\n';
      important.forEach(a => {
        nextSteps += `- ${a.action}\n`;
      });
    }
  } else {
    nextSteps += friendly
      ? "We'll prepare a detailed quote based on these findings.\n"
      : "Quote will be prepared based on survey findings.\n";
  }
  
  return nextSteps;
}

/**
 * Generate explanation for engineer audience
 */
function explainForEngineer(rockyFacts: RockyFacts): SarahExplanation['sections'] {
  const facts = rockyFacts?.facts ?? {};
  
  let summary = 'Technical survey summary:\n\n';
  
  if (facts.existingSystem) {
    summary += `System: ${facts.existingSystem.systemType || 'Unknown'}\n`;
    summary += `Make/Model: ${facts.existingSystem.boilerMake || ''} ${facts.existingSystem.boilerModel || ''}\n`;
    summary += `Age: ${facts.existingSystem.boilerAge || 'Unknown'} years\n`;
    summary += `Condition: ${facts.existingSystem.condition || 'Unknown'}\n\n`;
  }
  
  let measurementsSummary = 'Measurements:\n';
  if (facts.measurements) {
    measurementsSummary += `Pipe: ${facts.measurements.pipeSize || 'Not recorded'}\n`;
    measurementsSummary += `Fuse: ${facts.measurements.mainFuseRating || 'Not recorded'}A\n`;
    measurementsSummary += `Rads: ${facts.measurements.radiatorCount || 'Not recorded'}\n`;
    measurementsSummary += `Cylinder: ${facts.measurements.cylinderCapacity || 'Not recorded'}L\n`;
  }
  
  let materialsExplanation = '';
  if (facts.materials && facts.materials.length > 0) {
    materialsExplanation = 'Materials noted:\n';
    facts.materials.forEach(m => {
      materialsExplanation += `- ${m.name}${m.quantity ? ` x${m.quantity}` : ''}\n`;
    });
  }
  
  let hazardsWarning = '';
  if (facts.hazards && facts.hazards.length > 0) {
    hazardsWarning = 'Hazards identified:\n';
    facts.hazards.forEach(h => {
      hazardsWarning += `- ${h.type} (${h.severity})\n`;
    });
  }
  
  return {
    summary,
    measurementsSummary,
    materialsExplanation,
    hazardsWarning,
  };
}

/**
 * Generate explanation for surveyor audience
 */
function explainForSurveyor(rockyFacts: RockyFacts): SarahExplanation['sections'] {
  const facts = rockyFacts?.facts ?? {};
  
  let summary = 'Survey fact check:\n\n';
  
  // Completeness overview
  const overall = rockyFacts?.completeness?.overall ?? 0;
  summary += `Completeness: ${overall}%\n`;
  if (overall < 70) {
    summary += '⚠️ Additional information needed\n';
  }
  summary += '\n';
  
  // Missing data
  const missingData = rockyFacts?.missingData ?? [];
  if (missingData.length > 0) {
    const required = missingData.filter(m => m.required);
    if (required.length > 0) {
      summary += 'Required fields missing:\n';
      required.forEach(m => {
        summary += `- ${m.category}.${m.field}\n`;
      });
      summary += '\n';
    }
  }
  
  // Key measurements
  let measurementsSummary = 'Key measurements captured:\n';
  if (facts.measurements) {
    const captured = Object.entries(facts.measurements).filter(([_, v]) => v !== undefined);
    if (captured.length > 0) {
      captured.forEach(([key, value]) => {
        measurementsSummary += `✓ ${key}: ${value}\n`;
      });
    } else {
      measurementsSummary += 'None recorded - revisit site\n';
    }
  }
  
  // Next actions
  let nextStepsGuidance = 'Actions for next visit:\n';
  if (facts.requiredActions && facts.requiredActions.length > 0) {
    facts.requiredActions.forEach(a => {
      nextStepsGuidance += `- [${a.priority}] ${a.action}\n`;
    });
  } else if (rockyFacts.completeness.overall < 70) {
    nextStepsGuidance += '- Complete missing fields\n';
    nextStepsGuidance += '- Verify measurements\n';
  } else {
    nextStepsGuidance += '- Survey complete, proceed to quote\n';
  }
  
  return {
    summary,
    measurementsSummary,
    nextStepsGuidance,
  };
}

// ============================================
// Main Sarah Processing Function
// ============================================

/**
 * Generate explanation from RockyFacts
 * Template-based for now, can be enhanced with LLM later
 */
export async function explainRockyFacts(request: SarahExplainRequest): Promise<SarahProcessResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const { rockyFacts, audience, tone = 'professional' } = request;
    
    // Defensive defaults: Sarah must never throw due to missing Rocky buckets.
    // This also supports "empty facts" flows where Rocky ran but didn't match anything yet.
    const normalizedRockyFacts: RockyFacts = {
      version: (rockyFacts as any)?.version ?? '1.0.0',
      sessionId: (rockyFacts as any)?.sessionId ?? -1,
      processedAt: (rockyFacts as any)?.processedAt ?? new Date(),
      naturalNotesHash: (rockyFacts as any)?.naturalNotesHash ?? 'unknown',
      facts: (rockyFacts as any)?.facts ?? {},
      completeness: (rockyFacts as any)?.completeness ?? {
        customerInfo: 0,
        propertyDetails: 0,
        existingSystem: 0,
        measurements: 0,
        overall: 0,
      },
      missingData: (rockyFacts as any)?.missingData ?? [],
    } as RockyFacts;
    
    // Add warnings if input looks empty/misaligned
    const hasFacts =
      normalizedRockyFacts.facts &&
      Object.values(normalizedRockyFacts.facts).some((v) => {
        if (Array.isArray(v)) return v.length > 0;
        if (v && typeof v === 'object') return Object.keys(v as any).length > 0;
        return Boolean(v);
      });
    if (!hasFacts) {
      warnings.push('Rocky facts appear empty. Ensure you are passing `result.rockyFacts` (not the whole API response).');
    }
    
    // Generate audience-specific explanation
    let sections: SarahExplanation['sections'];
    
    switch (audience) {
      case 'customer':
        sections = explainForCustomer(normalizedRockyFacts, tone);
        break;
      case 'engineer':
        sections = explainForEngineer(normalizedRockyFacts);
        break;
      case 'surveyor':
        sections = explainForSurveyor(normalizedRockyFacts);
        break;
      case 'manager':
        // For now, use surveyor explanation for managers
        sections = explainForSurveyor(normalizedRockyFacts);
        break;
      case 'admin':
        // For now, use simplified customer explanation
        sections = explainForCustomer(normalizedRockyFacts, 'simple');
        break;
      default:
        throw new Error(`Unknown audience: ${audience}`);
    }
    
    // Build explanation
    const explanation: SarahExplanation = {
      audience,
      tone,
      generatedAt: new Date(),
      rockyFactsVersion: normalizedRockyFacts.version,
      sections,
      disclaimer: SARAH_CONFIG.audienceTemplates[audience].disclaimerTemplate,
    };
    
    const processingTimeMs = Date.now() - startTime;
    
    return {
      success: true,
      explanation,
      processingTimeMs,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    errors.push(`Sarah explanation failed: ${(error as Error).message}`);
    throw new Error(`Sarah explanation failed: ${(error as Error).message}`);
  }
}

/**
 * Pattern matching configuration for common questions
 */
const CHAT_PATTERNS = {
  greeting: {
    patterns: ['hello', 'hi', 'hey'],
    customerResponse: "Hello! I'm Sarah, your AI assistant. I can help explain survey findings, answer questions about your heating system, and guide you through the next steps. What would you like to know?",
    otherResponse: "Hi there! I'm Sarah. I can help you understand survey data and provide explanations. What can I help you with?"
  },
  help: {
    patterns: ['help', 'what can you'],
    response: "I can help you with:\n- Explaining survey findings in simple terms\n- Answering questions about your heating system\n- Clarifying technical details\n- Guiding you through next steps\n- Addressing any concerns you might have\n\nWhat would you like to know more about?"
  },
  survey: {
    patterns: ['survey', 'finding'],
    response: "I can explain survey findings in detail. To give you the most accurate information, please share the survey data with me or ask about specific aspects like the property assessment, system condition, or required actions."
  },
  nextSteps: {
    patterns: ['next', 'step'],
    requiresBoth: true,
    response: "The next steps typically include: reviewing the survey findings, getting a detailed quote based on the assessment, and scheduling the installation. Would you like me to explain any specific part of this process?"
  },
  thanks: {
    patterns: ['thank'],
    response: "You're welcome! Feel free to ask if you have any other questions."
  }
}

/**
 * Normalize message for pattern matching
 * Removes punctuation, extra whitespace, and converts to lowercase
 */
function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[.,!?;:]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
}

/**
 * Check if message matches a pattern
 */
function matchesPattern(message: string, pattern: typeof CHAT_PATTERNS[keyof typeof CHAT_PATTERNS]): boolean {
  const normalized = normalizeMessage(message);
  
  if ('requiresBoth' in pattern && pattern.requiresBoth) {
    // All patterns must be present
    return pattern.patterns.every(p => normalized.includes(p));
  }
  
  // Any pattern matches
  return pattern.patterns.some(p => normalized.includes(p));
}

/**
 * Handle chat message
 * Provides conversational responses based on user messages
 */
export async function handleChatMessage(
  message: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  audience: SarahAudience = 'customer',
  tone: SarahTone = 'friendly'
): Promise<SarahProcessResult> {
  const startTime = Date.now();
  
  try {
    let responseText = '';
    
    // Check patterns in order
    if (matchesPattern(message, CHAT_PATTERNS.greeting)) {
      responseText = audience === 'customer' 
        ? CHAT_PATTERNS.greeting.customerResponse
        : CHAT_PATTERNS.greeting.otherResponse;
    } else if (matchesPattern(message, CHAT_PATTERNS.help)) {
      responseText = CHAT_PATTERNS.help.response;
    } else if (matchesPattern(message, CHAT_PATTERNS.survey)) {
      responseText = CHAT_PATTERNS.survey.response;
    } else if (matchesPattern(message, CHAT_PATTERNS.nextSteps)) {
      responseText = CHAT_PATTERNS.nextSteps.response;
    } else if (matchesPattern(message, CHAT_PATTERNS.thanks)) {
      responseText = CHAT_PATTERNS.thanks.response;
    } else {
      // Generic helpful response
      const contextNote = conversationHistory && conversationHistory.length > 0 
        ? "Based on our conversation, " 
        : "";
      
      responseText = audience === 'customer'
        ? `${contextNote}I'd be happy to help with that. To provide you with the most accurate information, could you give me a bit more detail about what you'd like to know? For example, are you asking about the survey results, the heating system, costs, or the installation process?`
        : `${contextNote}I can assist with that. Please provide more context or specific details so I can give you the most relevant information.`;
    }
    
    // Build explanation structure
    const explanation: SarahExplanation = {
      audience,
      tone,
      generatedAt: new Date(),
      rockyFactsVersion: '1.0.0',
      sections: {
        summary: responseText,
      },
      disclaimer: SARAH_CONFIG.audienceTemplates[audience].disclaimerTemplate,
    };
    
    const processingTimeMs = Date.now() - startTime;
    
    return {
      success: true,
      explanation,
      processingTimeMs,
    };
  } catch (error) {
    throw new Error(`Sarah chat failed: ${(error as Error).message}`);
  }
}

// ============================================
// Exports
// ============================================

export const sarahService = {
  explainRockyFacts,
  handleChatMessage,
  config: SARAH_CONFIG,
};
