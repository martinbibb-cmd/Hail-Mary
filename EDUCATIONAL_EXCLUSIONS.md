# Educational Exclusions - Show But Explain Why Not

## Overview

This feature implements a **transparent and educational** approach to heating system recommendations. Instead of hiding unsuitable options, we **show all options** but clearly mark and explain why certain systems aren't recommended.

## Why This Approach?

### ❌ Hiding Options (Bad UX):
- User: "Why no combi? Are they trying to upsell me?"
- Creates distrust and suspicion
- User might ask installer to quote combi anyway
- Misses educational opportunity

### ✅ Showing With Reasons (Good UX):
- User: *reads* "Oh! 3 showers = 36 L/min needed, combi only supplies 12 L/min"
- Educational and transparent
- User goes to installer saying "I understand why we need a cylinder"
- **Builds trust** in your recommendation tool

## Implementation Details

### 1. Core Logic (`systemRecommendation.ts`)

#### New Input Parameters
```typescript
interface SystemRecInput {
  // ... existing fields
  occupants?: number;           // Number of people in household
  flowRate?: number;            // Mains water flow rate (L/min)
  mainsPressure?: number;       // Mains water pressure (bar)
  urgency?: 'emergency' | 'urgent' | 'normal';
  considerMixergy?: boolean;    // Enable Mixergy smart cylinder option
}
```

#### Exclusion Evaluation Function
```typescript
function evaluateSystemSuitability(
  systemId: string,
  input: SystemRecInput,
  propertySize: PropertySize
): SuitabilityEvaluation
```

Returns:
- `excluded`: boolean - Is this option unsuitable?
- `reason`: string - Educational explanation of why
- `penaltyScore`: number - Score penalty (typically -100 to -90)

### 2. Exclusion Rules

#### Combi Boiler Exclusions

**3+ Bathrooms**
```
Reason: "❌ Not suitable: 3 bathrooms need 36 L/min for simultaneous showers,
but combi boilers typically only supply 10-15 L/min. Physics makes this
impossible - you'd get cold water when two showers run."
Penalty: -100
```

**Low Flow Rate**
```
Reason: "❌ Not suitable: Mains flow rate of 10 L/min is too low for a combi
boiler (minimum 14 L/min recommended). You'd experience weak water pressure
and cold showers."
Penalty: -100
```

**Low Mains Pressure**
```
Reason: "❌ Not suitable: Mains pressure of 1.2 bar is too low for a combi
boiler (minimum 1.5 bar required). Hot water flow would be inadequate."
Penalty: -100
```

**5+ Occupants**
```
Reason: "❌ Not suitable: 5 occupants creates high hot water demand. Combi
boilers can't store hot water, so someone will always be waiting. A
cylinder-based system provides a reserve for peak times."
Penalty: -100
```

#### Storage Combi Exclusions

**3+ Bathrooms**
```
Reason: "❌ Not suitable: Storage combis typically have 40-60L tanks.
3 bathrooms need ~45L for simultaneous draws, which exhausts the tank
in under 2 minutes."
Penalty: -90
```

#### Heat Pump Exclusions

**Emergency Urgency**
```
Reason: "❌ Not suitable: Heat pumps require 4-8 weeks for surveys, design,
and installation. For emergency replacement (needed in 1-2 days), a gas
boiler is the only viable option."
Penalty: -100
```

**Very Poor Insulation**
```
Reason: "❌ Not suitable: Heat pumps operate at lower temperatures (45-50°C)
and require excellent insulation. Your insulation quality is too poor - you'd
need major insulation upgrades first (£8,000-15,000)."
Penalty: -90
```

#### Electric Heating Exclusions

**Large Properties**
```
Reason: "❌ Not suitable: Electric heating costs ~16p/kWh vs gas at ~6p/kWh.
For a large property, annual costs would be £2,500-3,500 vs £900-1,200 for
gas. A heat pump would be far more economical."
Penalty: -95
```

### 3. Mixergy Integration

When `considerMixergy: true`, the system boiler option includes:

- **Mixergy smart cylinder** instead of traditional unvented cylinder
- **30-40% energy savings** through smart heating
- **App-controlled** hot water on demand
- **£500 additional cost** for Mixergy upgrade
- **Reduced running costs**: £750/year vs £950/year traditional

## Visual Display

### Recommended Option (Normal)
```
┌─────────────────────────────────────────────┐
│ Option A   ✅ Recommended                   │
│ Gas System Boiler + Mixergy Smart Cylinder  │
│                                             │
│ Installation: £4,400 - £8,400               │
│ Annual Running Cost: £900                   │
│ Confidence: 80/100                          │
│                                             │
│ ✅ Benefits                                 │
│ • Supplies multiple outlets simultaneously  │
│ • Mixergy smart heating: only heat needed   │
│ • 30-40% energy savings                     │
│                                             │
│ ⚠️ Considerations                           │
│ • Requires cylinder space                   │
│ • Annual cylinder service recommended       │
└─────────────────────────────────────────────┘
```

### Excluded Option (Dimmed with Warning)
```
┌─────────────────────────────────────────────┐
│ Option B   🚫 Not Recommended               │
│ Modern Gas Combi Boiler                     │
│                                             │
│ ⚠️ WHY THIS ISN'T SUITABLE:                │
│ 3 bathrooms need 36 L/min for simultaneous │
│ showers, but combi boilers only supply     │
│ 10-15 L/min. Physics makes this impossible.│
│                                             │
│ We show this for transparency and education │
│                                             │
│ Installation: £3,000 - £5,400 (for ref.)   │
│ Confidence: ~~90~~ → -10                   │
│                                             │
│ ⚠️ Considerations                           │
│ • ❌ Not suitable: [exclusion reason above] │
│ • Requires gas connection                   │
│ • Fossil fuel - not future-proofed          │
└─────────────────────────────────────────────┘
```

## Example Scenario

### Family with 3 Bathrooms

**Input:**
```typescript
{
  bathrooms: 3,
  occupants: 5,
  flowRate: 15,
  hasGasConnection: true,
  considerMixergy: true
}
```

**Output:**

**Option A: Gas System Boiler + Mixergy Cylinder** ✅
- Score: 80
- Status: Recommended
- Why: 3 bathrooms need cylinder capacity; Mixergy reduces energy waste by 30-40%

**Option B: Gas Combi Boiler** 🚫
- Score: ~~90~~ → -10 (excluded with -100 penalty)
- Status: Not Recommended
- Why: "3 bathrooms need 36 L/min for simultaneous showers, but combis only supply 10-15 L/min"

**Option C: Air Source Heat Pump** ✅
- Score: 85
- Status: Alternative
- Why: Future-proof, £7,500 grant available

## Benefits

### For Users
1. **Transparency**: Understand why certain options won't work
2. **Education**: Learn about heating system requirements
3. **Trust**: No hidden agendas or upselling concerns
4. **Informed decisions**: Go to installer with full knowledge

### For Installers
1. **Pre-educated customers**: Users already understand why they need certain systems
2. **Fewer objections**: "Why not a combi?" already answered
3. **Trust building**: Users see you're being honest and educational
4. **Better quotes**: Users request appropriate systems from the start

## Usage

### In Frontend (React)

```typescript
import { SystemRecommendationCard } from '@/components/SystemRecommendationCard';

// Get recommendations from API
const { primaryRecommendation, alternatives } = await fetchRecommendations(leadId);

// Display all recommendations (including excluded ones)
const allOptions = [primaryRecommendation, ...alternatives];

return (
  <div>
    {allOptions.map((rec, index) => (
      <SystemRecommendationCard
        key={rec.id}
        recommendation={rec}
        index={index}
      />
    ))}
  </div>
);
```

### In API

```typescript
import { computeSystemRecommendation } from '@hail-mary/shared';

const input = {
  propertyType: 'semi_detached',
  bedrooms: 4,
  bathrooms: 3,
  occupants: 5,
  flowRate: 15,
  mainsPressure: 2.5,
  hasGasConnection: true,
  considerMixergy: true,
  urgency: 'normal',
  // ... other fields
};

const result = computeSystemRecommendation(input);

// result.primaryRecommendation: The best option
// result.alternatives: All other options (including excluded ones)
```

## Testing Scenarios

### Test 1: Large Family (3 Bathrooms)
```typescript
{
  bathrooms: 3,
  occupants: 5,
  hasGasConnection: true
}
```
**Expected**: Combi excluded, system boiler recommended

### Test 2: Emergency Replacement
```typescript
{
  urgency: 'emergency',
  hasGasConnection: true
}
```
**Expected**: Heat pump excluded (too slow), gas boiler recommended

### Test 3: Low Water Pressure
```typescript
{
  bathrooms: 2,
  flowRate: 10,
  mainsPressure: 1.2,
  hasGasConnection: true
}
```
**Expected**: Combi excluded, system boiler recommended

### Test 4: Poor Insulation
```typescript
{
  insulationQuality: 1,
  hasGasConnection: false
}
```
**Expected**: Heat pump excluded, electric heating as alternative

## Future Enhancements

1. **Mixergy Performance Modeling**: Real-time hot water availability predictions
2. **Visual Flow Diagrams**: Show water flow limitations graphically
3. **Installation Timeline**: Show time comparisons (e.g., "Heat pump: 4-8 weeks" vs "Boiler: 1-2 days")
4. **Cost Calculator**: Interactive sliders to show impact of different scenarios
5. **Installer Finder**: Connect to installers who specialize in recommended systems

## Conclusion

This approach transforms system recommendations from a "black box" into an **educational tool** that builds trust and empowers users to make informed decisions. By showing unsuitable options with clear explanations, we:

- **Build credibility** through transparency
- **Educate users** about heating system requirements
- **Reduce objections** from users and installers
- **Create better outcomes** with properly matched systems

The key insight: **Hiding information creates suspicion; explaining information builds trust.**
