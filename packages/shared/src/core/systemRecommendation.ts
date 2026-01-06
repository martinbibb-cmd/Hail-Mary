/**
 * System Recommendation Engine
 * 
 * Provides system recommendation computation for heating systems.
 * Analyzes property data and current systems to recommend heating solutions.
 */

/**
 * Current ruleset version for system recommendations
 * Increment when recommendation logic changes
 */
export const RULESET_VERSION = '1.0.0';

/**
 * Business rule constants
 */
const SYSTEM_REPLACEMENT_AGE_THRESHOLD = 12; // years
const URGENT_REPLACEMENT_AGE_THRESHOLD = 15; // years
const BOILER_UPGRADE_SCHEME_GRANT = 7500; // £

/**
 * Property size category
 */
export type PropertySize = 'small' | 'medium' | 'large' | 'very_large';

/**
 * Property type
 */
export type PropertyType = 'detached' | 'semi_detached' | 'terraced' | 'flat' | 'bungalow' | 'other';

/**
 * Current heating system type
 */
export type CurrentSystemType = 'gas_boiler' | 'oil_boiler' | 'lpg_boiler' | 'electric' | 'heat_pump' | 'other' | 'none';

/**
 * Fuel type preference
 */
export type FuelType = 'gas' | 'oil' | 'lpg' | 'electric' | 'heat_pump' | 'hybrid';

/**
 * Input data for system recommendation
 */
export interface SystemRecInput {
  /** Property type */
  propertyType: PropertyType;
  /** Number of bedrooms (used to estimate size) */
  bedrooms: number;
  /** Number of bathrooms */
  bathrooms: number;
  /** Current heating system type */
  currentSystem: CurrentSystemType;
  /** Age of current system in years */
  systemAge?: number;
  /** Is gas connection available */
  hasGasConnection: boolean;
  /** Estimated annual heating cost (£) */
  annualHeatingCost?: number;
  /** Property age band */
  propertyAge?: string;
  /** Insulation quality (1-5, 5 = excellent) */
  insulationQuality?: number;
  /** Number of occupants */
  occupants?: number;
  /** Mains water flow rate (L/min) */
  flowRate?: number;
  /** Mains water pressure (bar) */
  mainsPressure?: number;
  /** Installation urgency (days needed) */
  urgency?: 'emergency' | 'urgent' | 'normal';
  /** Consider Mixergy smart cylinder */
  considerMixergy?: boolean;
}

/**
 * System recommendation priority level
 */
export type RecommendationPriority = 'primary' | 'alternative' | 'future';

/**
 * Confidence level for recommendation
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Single system recommendation
 */
export interface SystemRecommendation {
  /** Unique identifier for this recommendation option */
  id: string;
  /** Priority level */
  priority: RecommendationPriority;
  /** Display title */
  title: string;
  /** System type being recommended */
  systemType: FuelType;
  /** Detailed description */
  description: string;
  /** Estimated cost range */
  estimatedCost: {
    low: number;
    high: number;
  };
  /** Estimated annual savings (£) */
  annualSavings?: number;
  /** Estimated annual running cost (£) */
  annualRunningCost?: number;
  /** Key benefits */
  benefits: string[];
  /** Considerations/drawbacks */
  considerations: string[];
  /** Available grants */
  grants?: string[];
  /** Confidence score (0-100) */
  confidence: number;
  /** Confidence level */
  confidenceLevel: ConfidenceLevel;
  /** Reasons for this recommendation */
  rationale: string[];
  /** Is this option excluded (shown but not recommended) */
  excluded?: boolean;
  /** Reason for exclusion (shown to educate user) */
  exclusionReason?: string;
  /** Original score before exclusion penalty */
  originalScore?: number;
}

/**
 * Complete system recommendation output
 */
export interface SystemRecOutput {
  /** Ruleset version used */
  rulesetVersion: string;
  /** Primary recommendation */
  primaryRecommendation: SystemRecommendation;
  /** Alternative recommendations */
  alternatives: SystemRecommendation[];
  /** Overall summary */
  summary: string;
  /** Key insights */
  insights: string[];
  /** Next steps */
  nextSteps: string[];
  /** Estimated property size */
  estimatedPropertySize: PropertySize;
}

/**
 * Compute system recommendation based on input data
 */
export function computeSystemRecommendation(input: SystemRecInput): SystemRecOutput {
  // Estimate property size based on bedrooms
  const estimatedPropertySize = estimatePropertySize(input.bedrooms);
  
  // Generate recommendations based on input
  const recommendations = generateRecommendations(input, estimatedPropertySize);
  
  // Sort by confidence and priority
  const sortedRecs = recommendations.sort((a, b) => {
    const priorityOrder = { primary: 0, alternative: 1, future: 2 };
    if (a.priority !== b.priority) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.confidence - a.confidence;
  });
  
  const primary = sortedRecs[0];
  const alternatives = sortedRecs.slice(1);
  
  // Generate summary
  const summary = generateSummary(input, primary, estimatedPropertySize);
  
  // Generate insights
  const insights = generateInsights(input, primary);
  
  // Generate next steps
  const nextSteps = generateNextSteps(primary);
  
  return {
    rulesetVersion: RULESET_VERSION,
    primaryRecommendation: primary,
    alternatives,
    summary,
    insights,
    nextSteps,
    estimatedPropertySize,
  };
}

/**
 * Estimate property size based on bedrooms
 */
function estimatePropertySize(bedrooms: number): PropertySize {
  if (bedrooms <= 2) return 'small';
  if (bedrooms === 3) return 'medium';
  if (bedrooms === 4) return 'large';
  return 'very_large';
}

/**
 * Suitability evaluation result for a system option
 */
interface SuitabilityEvaluation {
  excluded: boolean;
  reason?: string;
  penaltyScore: number;
}

/**
 * Evaluate system suitability with educational exclusion reasons
 * Returns exclusion status, reason, and penalty score
 */
function evaluateSystemSuitability(
  systemId: string,
  input: SystemRecInput,
  propertySize: PropertySize
): SuitabilityEvaluation {
  const { bathrooms, occupants, flowRate, mainsPressure, urgency } = input;

  // Default: suitable
  let excluded = false;
  let reason: string | undefined;
  let penaltyScore = 0;

  // Combi boiler exclusions
  if (systemId === 'gas-combi-boiler') {
    // 3+ bathrooms need simultaneous hot water
    if (bathrooms >= 3) {
      excluded = true;
      const requiredFlow = bathrooms * 12; // ~12 L/min per shower
      reason = `❌ Not suitable: ${bathrooms} bathrooms need ${requiredFlow} L/min for simultaneous showers, but combi boilers typically only supply 10-15 L/min. Physics makes this impossible - you'd get cold water when two showers run.`;
      penaltyScore = -100;
    }
    // Low flow rate
    else if (flowRate && flowRate < 14) {
      excluded = true;
      reason = `❌ Not suitable: Mains flow rate of ${flowRate} L/min is too low for a combi boiler (minimum 14 L/min recommended). You'd experience weak water pressure and cold showers.`;
      penaltyScore = -100;
    }
    // Low mains pressure
    else if (mainsPressure && mainsPressure < 1.5) {
      excluded = true;
      reason = `❌ Not suitable: Mains pressure of ${mainsPressure} bar is too low for a combi boiler (minimum 1.5 bar required). Hot water flow would be inadequate.`;
      penaltyScore = -100;
    }
    // 5+ occupants means high simultaneous demand
    else if (occupants && occupants >= 5) {
      excluded = true;
      reason = `❌ Not suitable: ${occupants} occupants creates high hot water demand. Combi boilers can't store hot water, so someone will always be waiting. A cylinder-based system provides a reserve for peak times.`;
      penaltyScore = -100;
    }
  }

  // Storage combi exclusions
  if (systemId === 'gas-storage-combi') {
    // 3+ bathrooms with limited storage
    if (bathrooms >= 3) {
      excluded = true;
      const requiredStorage = bathrooms * 15; // Rough estimate: 15L per bathroom
      reason = `❌ Not suitable: Storage combis typically have 40-60L tanks. ${bathrooms} bathrooms need ~${requiredStorage}L for simultaneous draws, which exhausts the tank in under 2 minutes.`;
      penaltyScore = -90;
    }
    // Low flow rate still an issue
    else if (flowRate && flowRate < 12) {
      excluded = true;
      reason = `❌ Not suitable: Low mains flow rate (${flowRate} L/min) limits combi performance even with storage tank. A system boiler with cylinder would be better.`;
      penaltyScore = -90;
    }
  }

  // Heat pump exclusions
  if (systemId === 'air-source-heat-pump') {
    // Emergency urgency
    if (urgency === 'emergency') {
      excluded = true;
      reason = `❌ Not suitable: Heat pumps require 4-8 weeks for surveys, design, and installation. For emergency replacement (needed in 1-2 days), a gas boiler is the only viable option.`;
      penaltyScore = -100;
    }
    // Very poor insulation
    else if (input.insulationQuality && input.insulationQuality <= 1) {
      excluded = true;
      reason = `❌ Not suitable: Heat pumps operate at lower temperatures (45-50°C) and require excellent insulation. Your insulation quality is too poor - you'd need major insulation upgrades first (£8,000-15,000).`;
      penaltyScore = -90;
    }
  }

  // Electric heating exclusions
  if (systemId === 'electric-heating') {
    // Large properties
    if (propertySize === 'very_large' || propertySize === 'large') {
      excluded = true;
      reason = `❌ Not suitable: Electric heating costs ~16p/kWh vs gas at ~6p/kWh. For a ${propertySize} property, annual costs would be £2,500-3,500 vs £900-1,200 for gas. A heat pump would be far more economical.`;
      penaltyScore = -95;
    }
  }

  return {
    excluded,
    reason,
    penaltyScore,
  };
}

/**
 * Generate system recommendations based on input
 */
function generateRecommendations(
  input: SystemRecInput,
  propertySize: PropertySize
): SystemRecommendation[] {
  const recommendations: SystemRecommendation[] = [];
  
  // Base estimated costs by property size
  const sizeCostMultiplier = {
    small: 1.0,
    medium: 1.2,
    large: 1.4,
    very_large: 1.6,
  };
  const multiplier = sizeCostMultiplier[propertySize];
  
  // Check if replacement is needed
  const needsReplacement = !input.systemAge || input.systemAge > SYSTEM_REPLACEMENT_AGE_THRESHOLD;
  
  // Gas boiler recommendation (if gas available)
  if (input.hasGasConnection) {
    const gasBoilerCost = {
      low: Math.round(2500 * multiplier),
      high: Math.round(4500 * multiplier),
    };

    // Evaluate suitability
    const suitability = evaluateSystemSuitability('gas-combi-boiler', input, propertySize);

    const baseConfidence = 90;
    const finalConfidence = suitability.excluded ? Math.max(10, baseConfidence + suitability.penaltyScore) : baseConfidence;

    const considerations = [
      'Requires gas connection',
      'Not suitable if multiple simultaneous hot water demands',
      'Fossil fuel - not future-proofed',
    ];

    // Add exclusion reason at the top of considerations if excluded
    if (suitability.excluded && suitability.reason) {
      considerations.unshift(suitability.reason);
    }

    recommendations.push({
      id: 'gas-combi-boiler',
      priority: suitability.excluded ? 'alternative' : 'primary',
      title: 'Modern Gas Combi Boiler',
      systemType: 'gas',
      description: 'High-efficiency A-rated gas combi boiler with built-in controls',
      estimatedCost: gasBoilerCost,
      annualSavings: needsReplacement && input.annualHeatingCost
        ? Math.round(input.annualHeatingCost * 0.25)
        : undefined,
      annualRunningCost: Math.round(800 * multiplier),
      benefits: [
        'Instant hot water on demand',
        'No cylinder space required',
        'Up to 94% efficiency',
        'Lower running costs than older models',
        'Reliable and proven technology',
      ],
      considerations,
      grants: [],
      confidence: finalConfidence,
      confidenceLevel: finalConfidence >= 75 ? 'high' : finalConfidence >= 60 ? 'medium' : 'low',
      rationale: [
        'Gas connection available',
        'Most cost-effective option for installation',
        'Proven reliability and performance',
      ],
      excluded: suitability.excluded,
      exclusionReason: suitability.reason,
      originalScore: suitability.excluded ? baseConfidence : undefined,
    });
  }
  
  // Heat pump recommendation (always consider)
  const heatPumpCost = {
    low: Math.round(8000 * multiplier),
    high: Math.round(14000 * multiplier),
  };

  const heatPumpGrants = [`Boiler Upgrade Scheme (£${BOILER_UPGRADE_SCHEME_GRANT.toLocaleString()})`];
  const heatPumpNetCost = {
    low: Math.max(500, heatPumpCost.low - BOILER_UPGRADE_SCHEME_GRANT),
    high: Math.max(6500, heatPumpCost.high - BOILER_UPGRADE_SCHEME_GRANT),
  };

  // Evaluate heat pump suitability
  const hpSuitability = evaluateSystemSuitability('air-source-heat-pump', input, propertySize);

  const heatPumpBaseConfidence = calculateHeatPumpConfidence(input);
  const heatPumpFinalConfidence = hpSuitability.excluded
    ? Math.max(10, heatPumpBaseConfidence + hpSuitability.penaltyScore)
    : heatPumpBaseConfidence;

  const heatPumpPriority: RecommendationPriority =
    hpSuitability.excluded ? 'future' : (!input.hasGasConnection ? 'primary' : 'alternative');

  const hpConsiderations = [
    'Higher upfront cost even with grant',
    'May require radiator upgrades',
    'Best with good insulation',
    'External unit required',
  ];

  if (hpSuitability.excluded && hpSuitability.reason) {
    hpConsiderations.unshift(hpSuitability.reason);
  }

  recommendations.push({
    id: 'air-source-heat-pump',
    priority: heatPumpPriority,
    title: 'Air Source Heat Pump',
    systemType: 'heat_pump',
    description: 'Low-carbon heating system with £7,500 government grant available',
    estimatedCost: heatPumpNetCost,
    annualSavings: input.annualHeatingCost
      ? Math.round(input.annualHeatingCost * 0.3)
      : undefined,
    annualRunningCost: Math.round(600 * multiplier),
    benefits: [
      '300-400% efficiency',
      'Future-proof low-carbon solution',
      '£7,500 government grant available',
      'Lower running costs than gas',
      'Can provide cooling in summer',
    ],
    considerations: hpConsiderations,
    grants: heatPumpGrants,
    confidence: heatPumpFinalConfidence,
    confidenceLevel: heatPumpFinalConfidence >= 75 ? 'high' : heatPumpFinalConfidence >= 60 ? 'medium' : 'low',
    rationale: [
      'Most efficient heating system available',
      'Government grant makes it affordable',
      input.hasGasConnection
        ? 'Future-proofs property against gas phase-out'
        : 'Best option without gas connection',
    ],
    excluded: hpSuitability.excluded,
    exclusionReason: hpSuitability.reason,
    originalScore: hpSuitability.excluded ? heatPumpBaseConfidence : undefined,
  });
  
  // Electric heating (if no gas and heat pump not suitable)
  if (!input.hasGasConnection) {
    const elecSuitability = evaluateSystemSuitability('electric-heating', input, propertySize);

    const elecBaseConfidence = 60;
    const elecFinalConfidence = elecSuitability.excluded
      ? Math.max(10, elecBaseConfidence + elecSuitability.penaltyScore)
      : elecBaseConfidence;

    const elecConsiderations = [
      'Higher running costs than heat pump',
      'Requires good insulation',
      'Better with solar panels',
    ];

    if (elecSuitability.excluded && elecSuitability.reason) {
      elecConsiderations.unshift(elecSuitability.reason);
    }

    recommendations.push({
      id: 'electric-heating',
      priority: elecSuitability.excluded ? 'future' : 'alternative',
      title: 'Modern Electric Heating',
      systemType: 'electric',
      description: 'High-efficiency electric radiators or storage heaters',
      estimatedCost: {
        low: Math.round(3000 * multiplier),
        high: Math.round(6000 * multiplier),
      },
      annualRunningCost: Math.round(1400 * multiplier),
      benefits: [
        'Lower installation cost',
        'No maintenance required',
        'Individual room control',
        'Quick to install',
      ],
      considerations: elecConsiderations,
      grants: [],
      confidence: elecFinalConfidence,
      confidenceLevel: elecFinalConfidence >= 75 ? 'high' : elecFinalConfidence >= 60 ? 'medium' : 'low',
      rationale: [
        'No gas connection available',
        'Lower upfront cost than heat pump',
        'Suitable for well-insulated properties',
      ],
      excluded: elecSuitability.excluded,
      exclusionReason: elecSuitability.reason,
      originalScore: elecSuitability.excluded ? elecBaseConfidence : undefined,
    });
  }
  
  // System boiler with cylinder (larger properties or high demand)
  if (propertySize === 'large' || propertySize === 'very_large' || input.bathrooms >= 2) {
    if (input.hasGasConnection) {
      // Calculate cylinder size based on occupants and bathrooms
      const cylinderSize = Math.max(
        200,
        (input.occupants || input.bathrooms * 2) * 50
      );

      // Mixergy consideration
      const useMixergy = input.considerMixergy === true;
      const cylinderType = useMixergy ? 'Mixergy smart cylinder' : 'unvented cylinder';
      const cylinderCostAddon = useMixergy ? 500 : 0;

      const systemBoilerBenefits = [
        'Supplies multiple outlets simultaneously',
        'High water pressure',
        'Suitable for larger properties',
        useMixergy ? 'Mixergy smart heating: only heat water you need' : 'Can integrate with solar thermal',
      ];

      if (useMixergy) {
        systemBoilerBenefits.push('App-controlled hot water on demand');
        systemBoilerBenefits.push('30-40% energy savings vs traditional cylinder');
      }

      recommendations.push({
        id: 'gas-system-boiler',
        priority: 'primary',
        title: `Gas System Boiler with ${useMixergy ? 'Mixergy Smart' : 'Unvented'} Cylinder`,
        systemType: 'gas',
        description: `System boiler with ${cylinderSize}L ${cylinderType} for multiple bathrooms`,
        estimatedCost: {
          low: Math.round((4000 + cylinderCostAddon) * multiplier),
          high: Math.round((7000 + cylinderCostAddon) * multiplier),
        },
        annualRunningCost: Math.round((useMixergy ? 750 : 950) * multiplier),
        annualSavings: useMixergy && input.annualHeatingCost
          ? Math.round(input.annualHeatingCost * 0.3)
          : undefined,
        benefits: systemBoilerBenefits,
        considerations: [
          'Requires cylinder space',
          'Higher installation cost',
          'Annual cylinder service recommended',
        ],
        grants: [],
        confidence: 80,
        confidenceLevel: 'high',
        rationale: [
          input.bathrooms >= 2 ? `${input.bathrooms} bathrooms need cylinder capacity` : 'Large property with multiple bathrooms',
          'Better for simultaneous hot water use',
          useMixergy ? 'Mixergy reduces energy waste by 30-40%' : 'Proven reliability',
        ],
        excluded: false,
      });
    }
  }

  // Storage combi (for moderate demand, low flow rate scenarios)
  if (input.hasGasConnection && input.bathrooms === 2) {
    const storageSuitability = evaluateSystemSuitability('gas-storage-combi', input, propertySize);

    const storageBaseConfidence = 65;
    const storageFinalConfidence = storageSuitability.excluded
      ? Math.max(10, storageBaseConfidence + storageSuitability.penaltyScore)
      : storageBaseConfidence;

    const storageConsiderations = [
      '40-60L storage tank provides buffer for short peaks',
      'Still limited for long simultaneous use',
      'More expensive than standard combi',
    ];

    if (storageSuitability.excluded && storageSuitability.reason) {
      storageConsiderations.unshift(storageSuitability.reason);
    }

    recommendations.push({
      id: 'gas-storage-combi',
      priority: storageSuitability.excluded ? 'future' : 'alternative',
      title: 'Gas Storage Combi Boiler',
      systemType: 'gas',
      description: 'Combi boiler with built-in 40-60L storage tank',
      estimatedCost: {
        low: Math.round(3200 * multiplier),
        high: Math.round(5500 * multiplier),
      },
      annualRunningCost: Math.round(850 * multiplier),
      benefits: [
        'Built-in hot water storage for peak demand',
        'More compact than system boiler + cylinder',
        'Better than standard combi for 2 bathrooms',
      ],
      considerations: storageConsiderations,
      grants: [],
      confidence: storageFinalConfidence,
      confidenceLevel: storageFinalConfidence >= 75 ? 'high' : storageFinalConfidence >= 60 ? 'medium' : 'low',
      rationale: [
        '2 bathrooms benefit from storage buffer',
        'Compromise between combi and system boiler',
      ],
      excluded: storageSuitability.excluded,
      exclusionReason: storageSuitability.reason,
      originalScore: storageSuitability.excluded ? storageBaseConfidence : undefined,
    });
  }
  
  return recommendations;
}

/**
 * Calculate confidence score for heat pump suitability
 */
function calculateHeatPumpConfidence(input: SystemRecInput): number {
  let confidence = 70; // Base confidence
  
  // No gas connection makes heat pump more attractive
  if (!input.hasGasConnection) {
    confidence += 15;
  }
  
  // Good insulation improves suitability
  if (input.insulationQuality && input.insulationQuality >= 4) {
    confidence += 10;
  } else if (input.insulationQuality && input.insulationQuality <= 2) {
    confidence -= 15;
  }
  
  // Newer properties typically better insulated
  if (input.propertyAge && (input.propertyAge.includes('post-2000') || input.propertyAge.includes('modern'))) {
    confidence += 5;
  }
  
  // High heating costs justify investment
  if (input.annualHeatingCost && input.annualHeatingCost > 1500) {
    confidence += 5;
  }
  
  return Math.min(95, Math.max(50, confidence));
}

/**
 * Generate summary text
 */
function generateSummary(
  input: SystemRecInput,
  primary: SystemRecommendation,
  propertySize: PropertySize
): string {
  const propertyDesc = `${propertySize} ${input.propertyType}`;
  const currentSystemDesc = input.currentSystem.replace(/_/g, ' ');
  
  let summary = `For your ${propertyDesc} property with ${input.bedrooms} bedroom(s), `;
  
  if (input.systemAge && input.systemAge > 12) {
    summary += `replacing your ${input.systemAge}-year-old ${currentSystemDesc} with `;
  } else {
    summary += `we recommend considering `;
  }
  
  summary += `${primary.title.toLowerCase()}. `;
  
  if (primary.grants && primary.grants.length > 0) {
    summary += `With available grants, `;
  }
  
  summary += `This option costs £${primary.estimatedCost.low.toLocaleString()}-£${primary.estimatedCost.high.toLocaleString()}`;
  
  if (primary.annualSavings) {
    summary += ` and could save you approximately £${primary.annualSavings.toLocaleString()} per year`;
  }
  
  summary += '.';
  
  return summary;
}

/**
 * Generate key insights
 */
function generateInsights(input: SystemRecInput, primary: SystemRecommendation): string[] {
  const insights: string[] = [];
  
  // Age-based insight
  if (input.systemAge) {
    if (input.systemAge > URGENT_REPLACEMENT_AGE_THRESHOLD) {
      insights.push(`Your current system is ${input.systemAge} years old - replacement is strongly recommended for safety and efficiency`);
    } else if (input.systemAge > SYSTEM_REPLACEMENT_AGE_THRESHOLD) {
      insights.push(`At ${input.systemAge} years old, your system is nearing end of life - plan for replacement soon`);
    }
  }
  
  // Gas connection insight
  if (!input.hasGasConnection) {
    insights.push('Without gas connection, electric solutions offer the best path forward');
  }
  
  // Grant insight
  if (primary.grants && primary.grants.length > 0) {
    insights.push(`Government grants available: ${primary.grants.join(', ')}`);
  }
  
  // Running cost insight
  if (primary.annualRunningCost && input.annualHeatingCost) {
    const difference = input.annualHeatingCost - primary.annualRunningCost;
    if (difference > 200) {
      insights.push(`Estimated annual running costs of £${primary.annualRunningCost} could save you £${Math.round(difference)} per year`);
    }
  }
  
  // Insulation insight
  if (input.insulationQuality && input.insulationQuality < 3) {
    insights.push('Consider improving insulation before or alongside system upgrade for maximum efficiency');
  }
  
  return insights;
}

/**
 * Generate next steps
 */
function generateNextSteps(primary: SystemRecommendation): string[] {
  const steps: string[] = [
    'Schedule a free site survey to assess your property',
    `Get detailed quote for ${primary.title}`,
  ];
  
  if (primary.grants && primary.grants.length > 0) {
    steps.push('Check grant eligibility and application process');
  }
  
  steps.push('Compare quotes from multiple installers');
  steps.push('Review installer certifications and warranties');
  
  return steps;
}
