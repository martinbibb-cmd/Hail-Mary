/**
 * Enhanced Data Extractor
 *
 * AI-powered extraction service that parses transcription data
 * and extracts information for multiple modules:
 * - Property details
 * - Boiler/heating system specifications
 * - Quotation requirements
 * - Customer preferences
 * - Installation requirements
 */

export interface PropertyData {
  propertyType?: 'detached' | 'semi' | 'terraced' | 'flat' | 'bungalow';
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  ageBand?: string;
  construction?: {
    walls?: string;
    roof?: string;
    floors?: string;
    glazing?: string;
  };
  loftInsulation?: boolean;
  loftDepth?: number;
  address?: {
    street?: string;
    city?: string;
    postcode?: string;
  };
}

export interface BoilerData {
  currentBoilerType?: 'combi' | 'system' | 'regular' | 'back_boiler';
  currentBoilerMake?: string;
  currentBoilerModel?: string;
  boilerAge?: number;
  boilerLocation?: string;
  flueType?: string;
  gasSupply?: string;
  waterPressure?: string;
  recommendedBoilerType?: string;
  replacementRequired?: boolean;
  replacementUrgency?: 'immediate' | 'soon' | 'future';
}

export interface QuotationData {
  workRequired?: string[];
  boilerReplacementNeeded?: boolean;
  cylinderReplacementNeeded?: boolean;
  radiatorUpgradeNeeded?: boolean;
  controlsUpgradeNeeded?: boolean;
  systemFlushNeeded?: boolean;
  estimatedCost?: number;
  urgency?: 'emergency' | 'urgent' | 'routine';
}

export interface OccupancyData {
  occupants?: number;
  schedule?: string;
  hotWaterUsage?: 'high' | 'medium' | 'low';
  heatingPatterns?: string;
  homeAllDay?: boolean;
  workFromHome?: boolean;
}

export interface ExtractedData {
  property: PropertyData;
  boiler: BoilerData;
  quotation: QuotationData;
  occupancy: OccupancyData;
  issues: string[];
  notes: string[];
  confidence: number; // 0-1 confidence score
}

/**
 * Extract structured data from transcript using pattern matching and NLP
 */
export function extractStructuredData(transcript: string): ExtractedData {
  const normalized = transcript.toLowerCase();

  const result: ExtractedData = {
    property: extractPropertyData(normalized),
    boiler: extractBoilerData(normalized),
    quotation: extractQuotationData(normalized),
    occupancy: extractOccupancyData(normalized),
    issues: extractIssues(normalized),
    notes: extractNotes(normalized),
    confidence: calculateConfidence(normalized),
  };

  return result;
}

/**
 * Extract property-specific data
 */
function extractPropertyData(transcript: string): PropertyData {
  const property: PropertyData = {};

  // Property type
  if (/\b(detached|detach)\b/.test(transcript)) {
    property.propertyType = 'detached';
  } else if (/\bsemi[- ]?detached\b/.test(transcript)) {
    property.propertyType = 'semi';
  } else if (/\bterraced?\b/.test(transcript)) {
    property.propertyType = 'terraced';
  } else if (/\b(flat|apartment)\b/.test(transcript)) {
    property.propertyType = 'flat';
  } else if (/\bbungalow\b/.test(transcript)) {
    property.propertyType = 'bungalow';
  }

  // Bedrooms
  const bedroomMatch = transcript.match(/(\d+)[- ]?bed(?:room)?s?/);
  if (bedroomMatch) {
    property.bedrooms = parseInt(bedroomMatch[1]);
  }

  // Bathrooms
  const bathroomMatch = transcript.match(/(\d+)[- ]?bath(?:room)?s?/);
  if (bathroomMatch) {
    property.bathrooms = parseInt(bathroomMatch[1]);
  }

  // Floors/Storeys
  const floorMatch = transcript.match(/(\d+)[- ]?(?:floor|storey|story)s?/);
  if (floorMatch) {
    property.floors = parseInt(floorMatch[1]);
  }

  // Age
  if (/\b(victorian|edwardian|1800s|1900s)\b/.test(transcript)) {
    property.ageBand = 'pre-1919';
  } else if (/\b(1920s|1930s|1940s|inter[- ]?war)\b/.test(transcript)) {
    property.ageBand = '1919-1944';
  } else if (/\b(1950s|1960s|post[- ]?war)\b/.test(transcript)) {
    property.ageBand = '1945-1964';
  } else if (/\b(1970s|1980s)\b/.test(transcript)) {
    property.ageBand = '1965-1982';
  } else if (/\b(1990s|2000s|new[- ]?build)\b/.test(transcript)) {
    property.ageBand = '1983-present';
  }

  // Construction
  property.construction = {};

  if (/\b(brick|cavity wall|solid wall)\b/.test(transcript)) {
    property.construction.walls = transcript.match(/solid wall/i)
      ? 'solid'
      : 'cavity';
  }

  if (/\b(tile|slate|felt|flat) roof\b/.test(transcript)) {
    const roofMatch = transcript.match(/\b(tile|slate|felt|flat) roof\b/);
    if (roofMatch) {
      property.construction.roof = roofMatch[1];
    }
  }

  if (/\b(double|single|triple)[- ]?glaz(?:ing|ed)\b/.test(transcript)) {
    const glazingMatch = transcript.match(/\b(double|single|triple)[- ]?glaz/);
    if (glazingMatch) {
      property.construction.glazing = glazingMatch[1] + ' glazed';
    }
  }

  // Loft insulation
  if (/\bloft insulation\b/.test(transcript)) {
    property.loftInsulation = true;
    const depthMatch = transcript.match(/(\d+)\s*(?:mm|millimeter|cm|centimeter)/);
    if (depthMatch) {
      property.loftDepth = parseInt(depthMatch[1]);
    }
  }

  return property;
}

/**
 * Extract boiler and heating system data
 */
function extractBoilerData(transcript: string): BoilerData {
  const boiler: BoilerData = {};

  // Boiler type
  if (/\bcombi(?:nation)? boiler\b/.test(transcript)) {
    boiler.currentBoilerType = 'combi';
  } else if (/\bsystem boiler\b/.test(transcript)) {
    boiler.currentBoilerType = 'system';
  } else if (/\b(?:regular|conventional|heat[- ]?only) boiler\b/.test(transcript)) {
    boiler.currentBoilerType = 'regular';
  } else if (/\bback boiler\b/.test(transcript)) {
    boiler.currentBoilerType = 'back_boiler';
  }

  // Boiler make/model
  const makes = ['worcester', 'vaillant', 'baxi', 'ideal', 'viessmann', 'vokera', 'potterton', 'glow-worm', 'alpha'];
  for (const make of makes) {
    if (new RegExp(`\\b${make}\\b`, 'i').test(transcript)) {
      boiler.currentBoilerMake = make.charAt(0).toUpperCase() + make.slice(1);
      break;
    }
  }

  // Boiler age
  const ageMatch = transcript.match(/(\d+)[- ]?(?:year|yr)s?[- ]?old/);
  if (ageMatch) {
    boiler.boilerAge = parseInt(ageMatch[1]);
  }

  // Boiler location
  if (/\b(?:kitchen|cupboard|airing cupboard|garage|loft|utility)\b/.test(transcript)) {
    const locationMatch = transcript.match(/\b(kitchen|cupboard|airing cupboard|garage|loft|utility)\b/);
    if (locationMatch) {
      boiler.boilerLocation = locationMatch[1];
    }
  }

  // Flue type
  if (/\b(horizontal|vertical|plume|balanced) flue\b/.test(transcript)) {
    const flueMatch = transcript.match(/\b(horizontal|vertical|plume|balanced) flue\b/);
    if (flueMatch) {
      boiler.flueType = flueMatch[1];
    }
  }

  // Replacement indicators
  if (/\b(replace|replacement|new boiler|upgrade)\b/.test(transcript)) {
    boiler.replacementRequired = true;

    if (/\b(urgent|asap|emergency|broken|failed|not working)\b/.test(transcript)) {
      boiler.replacementUrgency = 'immediate';
    } else if (/\b(soon|next (?:few )?months?|planning)\b/.test(transcript)) {
      boiler.replacementUrgency = 'soon';
    } else {
      boiler.replacementUrgency = 'future';
    }
  }

  return boiler;
}

/**
 * Extract quotation requirements
 */
function extractQuotationData(transcript: string): QuotationData {
  const quotation: QuotationData = {
    workRequired: [],
  };

  // Work items
  if (/\bboiler replacement\b/.test(transcript)) {
    quotation.workRequired!.push('Boiler Replacement');
    quotation.boilerReplacementNeeded = true;
  }

  if (/\bcylinder replacement\b/.test(transcript)) {
    quotation.workRequired!.push('Cylinder Replacement');
    quotation.cylinderReplacementNeeded = true;
  }

  if (/\b(?:radiator|rad)s? (?:replacement|upgrade|new)\b/.test(transcript)) {
    quotation.workRequired!.push('Radiator Upgrade');
    quotation.radiatorUpgradeNeeded = true;
  }

  if (/\b(?:controls?|thermostat|programmer) (?:replacement|upgrade|new)\b/.test(transcript)) {
    quotation.workRequired!.push('Controls Upgrade');
    quotation.controlsUpgradeNeeded = true;
  }

  if (/\b(?:system flush|power flush|clean(?:ing)?|cleanse)\b/.test(transcript)) {
    quotation.workRequired!.push('System Flush');
    quotation.systemFlushNeeded = true;
  }

  if (/\bpipework\b/.test(transcript)) {
    quotation.workRequired!.push('Pipework Modifications');
  }

  if (/\bgas work\b/.test(transcript)) {
    quotation.workRequired!.push('Gas Supply Work');
  }

  if (/\belectrical work\b/.test(transcript)) {
    quotation.workRequired!.push('Electrical Work');
  }

  // Estimated cost
  const costMatch = transcript.match(/£?([\d,]+)(?:\.\d{2})?/);
  if (costMatch) {
    const cost = parseInt(costMatch[1].replace(/,/g, ''));
    if (cost > 1000 && cost < 50000) {
      quotation.estimatedCost = cost;
    }
  }

  // Urgency
  if (/\b(emergency|urgent|asap|broken|failed)\b/.test(transcript)) {
    quotation.urgency = 'emergency';
  } else if (/\b(soon|next (?:few )?(?:week|month)s?)\b/.test(transcript)) {
    quotation.urgency = 'urgent';
  } else {
    quotation.urgency = 'routine';
  }

  return quotation;
}

/**
 * Extract occupancy patterns
 */
function extractOccupancyData(transcript: string): OccupancyData {
  const occupancy: OccupancyData = {};

  // Number of occupants
  const occupantMatch = transcript.match(/(\d+)\s+(?:people|person|occupants?|residents?|living)/);
  if (occupantMatch) {
    occupancy.occupants = parseInt(occupantMatch[1]);
  }

  // Work from home
  if (/\bwork(?:ing)? from home\b/.test(transcript)) {
    occupancy.workFromHome = true;
    occupancy.homeAllDay = true;
    occupancy.schedule = 'Work from home';
  } else if (/\b(?:out all day|work all day|9[- ]?to[- ]?5)\b/.test(transcript)) {
    occupancy.homeAllDay = false;
    occupancy.schedule = 'Out 9-5';
  } else if (/\bretired\b/.test(transcript)) {
    occupancy.homeAllDay = true;
    occupancy.schedule = 'Home all day (retired)';
  }

  // Hot water usage
  if (/\b(?:large family|many people|lots of showers|high usage)\b/.test(transcript)) {
    occupancy.hotWaterUsage = 'high';
  } else if (/\b(?:small family|couple|low usage)\b/.test(transcript)) {
    occupancy.hotWaterUsage = 'low';
  } else {
    occupancy.hotWaterUsage = 'medium';
  }

  // Heating patterns
  if (/\b(?:heating on all day|always warm|constant heat)\b/.test(transcript)) {
    occupancy.heatingPatterns = 'Continuous heating';
  } else if (/\b(?:heating morning and evening|twice a day|timed)\b/.test(transcript)) {
    occupancy.heatingPatterns = 'Morning and evening';
  }

  return occupancy;
}

/**
 * Extract issues and problems
 */
function extractIssues(transcript: string): string[] {
  const issues: string[] = [];

  const problemPatterns = [
    /\b(no heat(?:ing)?|cold|not warm(?:ing)?)\b/i,
    /\b(no hot water|cold water only)\b/i,
    /\b(leak(?:ing)?|drip(?:ping)?)\b/i,
    /\b(noisy|banging|knocking|whistling)\b/i,
    /\b(broken|failed|not working|faulty)\b/i,
    /\b(low pressure|no pressure)\b/i,
    /\b(error code|fault code|flashing)\b/i,
    /\b(smell|gas smell|burning smell)\b/i,
  ];

  for (const pattern of problemPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      issues.push(match[0]);
    }
  }

  return issues;
}

/**
 * Extract general notes
 */
function extractNotes(transcript: string): string[] {
  const notes: string[] = [];

  // Extract sentences containing important keywords
  const sentences = transcript.split(/[.!?]+/);
  const keywordPatterns = [
    /\bmeasurement\b/,
    /\bdistance\b/,
    /\baccess\b/,
    /\bpermission\b/,
    /\bplanning\b/,
    /\bpreference\b/,
    /\bcustomer (?:wants|needs|prefers)\b/,
  ];

  for (const sentence of sentences) {
    for (const pattern of keywordPatterns) {
      if (pattern.test(sentence)) {
        notes.push(sentence.trim());
        break;
      }
    }
  }

  return notes;
}

/**
 * Calculate confidence score based on extracted data
 */
function calculateConfidence(transcript: string): number {
  let confidence = 0;
  const wordCount = transcript.split(/\s+/).length;

  // Base confidence on transcript length
  if (wordCount > 100) confidence += 0.3;
  else if (wordCount > 50) confidence += 0.2;
  else if (wordCount > 20) confidence += 0.1;

  // Increase confidence based on specific keywords
  if (/\b(?:boiler|heating|radiator)\b/.test(transcript)) confidence += 0.2;
  if (/\b(?:property|house|flat|bedroom)\b/.test(transcript)) confidence += 0.2;
  if (/\b(?:customer|client|homeowner)\b/.test(transcript)) confidence += 0.1;
  if (/\b(?:quote|cost|price|estimate)\b/.test(transcript)) confidence += 0.1;
  if (/\b(?:work|install|replace|upgrade)\b/.test(transcript)) confidence += 0.1;

  return Math.min(confidence, 1.0);
}
