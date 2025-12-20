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
  const needsReplacement = !input.systemAge || input.systemAge > 12;
  
  // Gas boiler recommendation (if gas available)
  if (input.hasGasConnection) {
    const gasBoilerCost = {
      low: Math.round(2500 * multiplier),
      high: Math.round(4500 * multiplier),
    };
    
    recommendations.push({
      id: 'gas-combi-boiler',
      priority: 'primary',
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
      considerations: [
        'Requires gas connection',
        'Not suitable if multiple simultaneous hot water demands',
        'Fossil fuel - not future-proofed',
      ],
      grants: [],
      confidence: 90,
      confidenceLevel: 'high',
      rationale: [
        'Gas connection available',
        'Most cost-effective option for installation',
        'Proven reliability and performance',
      ],
    });
  }
  
  // Heat pump recommendation (always consider)
  const heatPumpCost = {
    low: Math.round(8000 * multiplier),
    high: Math.round(14000 * multiplier),
  };
  
  const heatPumpGrants = ['Boiler Upgrade Scheme (£7,500)'];
  const heatPumpNetCost = {
    low: Math.max(500, heatPumpCost.low - 7500),
    high: Math.max(6500, heatPumpCost.high - 7500),
  };
  
  const heatPumpPriority: RecommendationPriority = 
    !input.hasGasConnection ? 'primary' : 'alternative';
  
  const heatPumpConfidence = calculateHeatPumpConfidence(input);
  
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
    considerations: [
      'Higher upfront cost even with grant',
      'May require radiator upgrades',
      'Best with good insulation',
      'External unit required',
    ],
    grants: heatPumpGrants,
    confidence: heatPumpConfidence,
    confidenceLevel: heatPumpConfidence >= 75 ? 'high' : heatPumpConfidence >= 60 ? 'medium' : 'low',
    rationale: [
      'Most efficient heating system available',
      'Government grant makes it affordable',
      input.hasGasConnection 
        ? 'Future-proofs property against gas phase-out'
        : 'Best option without gas connection',
    ],
  });
  
  // Electric heating (if no gas and heat pump not suitable)
  if (!input.hasGasConnection) {
    recommendations.push({
      id: 'electric-heating',
      priority: 'alternative',
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
      considerations: [
        'Higher running costs than heat pump',
        'Requires good insulation',
        'Better with solar panels',
      ],
      grants: [],
      confidence: 60,
      confidenceLevel: 'medium',
      rationale: [
        'No gas connection available',
        'Lower upfront cost than heat pump',
        'Suitable for well-insulated properties',
      ],
    });
  }
  
  // System boiler with cylinder (larger properties)
  if (propertySize === 'large' || propertySize === 'very_large') {
    if (input.hasGasConnection) {
      recommendations.push({
        id: 'gas-system-boiler',
        priority: 'alternative',
        title: 'Gas System Boiler with Cylinder',
        systemType: 'gas',
        description: 'System boiler with unvented cylinder for multiple bathrooms',
        estimatedCost: {
          low: Math.round(4000 * multiplier),
          high: Math.round(7000 * multiplier),
        },
        annualRunningCost: Math.round(950 * multiplier),
        benefits: [
          'Supplies multiple outlets simultaneously',
          'High water pressure',
          'Suitable for larger properties',
          'Can integrate with solar thermal',
        ],
        considerations: [
          'Requires cylinder space',
          'Higher installation cost',
          'Annual cylinder service recommended',
        ],
        grants: [],
        confidence: 80,
        confidenceLevel: 'high',
        rationale: [
          'Large property with multiple bathrooms',
          'Better for simultaneous hot water use',
        ],
      });
    }
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
    if (input.systemAge > 15) {
      insights.push(`Your current system is ${input.systemAge} years old - replacement is strongly recommended for safety and efficiency`);
    } else if (input.systemAge > 12) {
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
