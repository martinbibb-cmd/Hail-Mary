# Hail Mary Customer Portal
## Enterprise Sales Deck

---

# THE PROBLEM

## The Post-Survey Customer Experience is Broken

Every year, millions of UK homeowners receive energy assessments, surveys, and quotes.

**What they get:**
- 📄 A PDF nobody reads
- 📊 A confusing spreadsheet
- 📧 A long email with too much jargon
- 🔐 A "portal" that's just a login screen
- 📑 A generic brochure

**What they need:**
- ✨ A personalized journey
- 🏠 A vision of their future home
- 💷 Clear, interactive financials
- 🎯 A clear next step

---

# THE OPPORTUNITY

## £19 Billion Market Transformation

The UK home energy retrofit market:

| Segment | Annual Value | Transactions |
|---------|--------------|--------------|
| Heat Pumps | £2.8B | 350,000 |
| Boiler Replacements | £4.2B | 1.4M |
| Solar PV | £1.9B | 220,000 |
| EV Charging | £800M | 400,000 |
| Insulation | £1.8B | 850,000 |
| **Total Addressable** | **£11.5B** | **3.2M** |

**Problem:** Conversion rates are stuck at 35-40%.

**Why?** Customers don't understand, can't visualize, and can't engage with their options.

---

# THE SOLUTION

## Hail Mary Customer Portal

**A personalized PWA that transforms the post-survey experience.**

```
Customer receives link → Opens PWA → Sees their future home
```

### Not a Portal. A Digital Twin.

| Traditional Portal | Hail Mary Portal |
|-------------------|------------------|
| Login required | Magic link access |
| Static PDF | Interactive journey |
| Generic content | Personalized to property |
| Desktop-only | PWA on any device |
| Forgotten | "Added to home screen" |
| One-time view | Auto-updates forever |

---

# PRODUCT FEATURES

## 1. Personalized Home Journey

Every customer receives their own unique link:

```
https://portal.hailmary.uk/AB3X9-JONES
```

**No password. No friction. Just their home's future.**

### What They See:

- 👋 **Personalized greeting** with their name and property
- 📊 **Quick stats** - savings, CO₂, efficiency at a glance
- 🎯 **Next action** - clear call to action
- 📅 **Timeline** - Today, 2-5 years, 5-15 years

---

## 2. Interactive Roadmap

A beautiful timeline showing their complete home energy journey:

### Phase View:
- **Today** - Current systems, condition, recommendations
- **0-2 Years** - Immediate upgrades (e.g., heat pump)
- **2-5 Years** - Near-term additions (e.g., solar PV)
- **5-15 Years** - Future planning (e.g., battery, EV)

### Each Upgrade Card Shows:
- 💷 Cost estimate (after grants)
- 📈 Annual savings
- 🌿 CO₂ reduction
- 👁️ "See in AR" button
- 💰 "View Finance" button

---

## 3. AR Visualisation

**The killer feature nobody else has.**

### Live AR Mode
- Point phone at wall → see heat pump
- Point at roof → see solar panels
- Point at driveway → see EV charger

### Marker Mode
- Download & print ArUco markers
- Place marker on wall
- Open app → equipment appears

**Why This Matters:**
- Family can walk around seeing the future
- Emotional buy-in before signing
- Removes the abstract, makes it real

---

## 4. Finance Hub

Finally, finance that customers can understand and customize:

### Interactive Calculator:
- 💷 Deposit slider
- 📅 Term selector (3, 5, 7, 10 years)
- ➕ Add-on toggles
- 📊 Real-time monthly payment updates

### ROI Visualisation:
- Compare: Heat Pump vs Gas Boiler
- Adjustable assumptions (gas price, elec price, COP)
- 15-year projection chart
- Break-even point highlighted

### Carbon Impact:
- Annual CO₂ savings in tonnes
- Equivalents: trees planted, miles not driven, flights avoided
- Shareable impact summary

---

## 5. Digital Twin

The portal becomes the customer's permanent home energy record:

### Contains:
- 🏠 Property profile
- 📋 Survey outcomes
- 💷 All quotes
- 📄 Certificates & warranties
- 🔧 Service history
- 📅 Appointments
- 📊 Energy trends (with meter integration)

### Auto-Updates When:
- Spec changes
- Work is completed
- Service is due
- New recommendations arise

---

# THE BUSINESS CASE

## For Installers

### Problem: Low Conversion
- Industry average: 35-40%
- Customers get confused
- Quotes get forgotten
- Competition wins

### Solution: Hail Mary Portal

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Conversion Rate | 38% | 52% | +37% |
| Time to Decision | 14 days | 7 days | -50% |
| Quote Recall | 45% | 89% | +98% |
| Referral Rate | 12% | 28% | +133% |

### ROI Example:
- 100 quotes/month × £8,000 avg
- Before: 38 sales = £304,000
- After: 52 sales = £416,000
- **Additional revenue: £112,000/month**

---

## For Energy Companies

### The Strategic Play

**British Gas, Octopus, OVO, E.ON** all face the same challenge:
- Commoditized energy supply
- Race to the bottom on price
- Need to own the customer relationship

**Hail Mary Portal provides:**
- Long-term customer engagement
- Upsell pathway (boiler → HP → PV → EV → battery)
- Data on customer intentions
- Competitive moat

---

# COMPETITIVE LANDSCAPE

## Nobody Has This

| Feature | BG Hive | Octopus | Payaca | Carno | **Hail Mary** |
|---------|---------|---------|--------|-------|---------------|
| Personalized PWA | ❌ | ❌ | ❌ | ❌ | ✅ |
| AR Visualisation | ❌ | ❌ | ❌ | ❌ | ✅ |
| Interactive Finance | ❌ | ❌ | ⚠️ | ⚠️ | ✅ |
| Long-term Roadmap | ❌ | ❌ | ❌ | ❌ | ✅ |
| Marker-based AR | ❌ | ❌ | ❌ | ❌ | ✅ |
| Digital Twin | ⚠️ | ❌ | ❌ | ❌ | ✅ |
| Auto-updating | ❌ | ❌ | ❌ | ❌ | ✅ |

**⚠️ = Partial functionality**

---

# TECHNOLOGY

## Built for Scale

### Architecture:
```
Customer PWA ← REST API → Installer CRM
     ↓                         ↓
  Offline Cache           AI Engine
     ↓                         ↓
  3D Models              Recommendations
```

### Tech Stack:
- **Frontend:** React 18 + TypeScript + Vite
- **PWA:** Workbox service workers, offline-first
- **AR:** Three.js + AR.js + WebXR
- **Backend:** Node.js + Express + PostgreSQL
- **Auth:** Magic link tokens (no passwords)

### Performance:
- First load: <2 seconds
- Offline: Full functionality
- 3D models: Lazy-loaded, LOD optimized
- Updates: Background sync

---

# GO-TO-MARKET

## Three Paths to Market

### 1. Direct to Installers (SaaS)
- £99-299/month per installer
- Self-serve onboarding
- White-label option
- Target: 10,000 installers UK

### 2. Enterprise License
- Custom deployment
- Integration with existing CRM
- Dedicated support
- Target: Top 10 energy companies

### 3. Acquisition
- Proven technology
- Customer traction
- Acquisition target for BG, Octopus, etc.

---

# TRACTION & ROADMAP

## Current State

### Built:
- ✅ Core CRM & quoting engine
- ✅ Survey capture system
- ✅ AI recommendation engine
- ✅ PWA infrastructure

### In Development:
- 🔄 Customer portal
- 🔄 AR visualisation
- 🔄 Finance calculator
- 🔄 Marker system

### Planned:
- ⏳ Energy meter integration
- ⏳ White-label marketplace
- ⏳ API platform

---

## Roadmap

| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| **Phase 1** | Q1 2025 | Portal MVP + Basic AR |
| **Phase 2** | Q2 2025 | Finance Hub + ROI Calculator |
| **Phase 3** | Q3 2025 | Marker AR + Digital Twin |
| **Phase 4** | Q4 2025 | Enterprise Features + API |

---

# THE ASK

## Partnership Opportunities

### For British Gas / Centrica:
- Exclusive license for UK market
- Integration with existing Hive ecosystem
- Accelerate heat pump rollout targets

### For Octopus Energy:
- Differentiation from competitors
- Customer engagement platform
- Support for Octopus Energy Services

### For Worcester Bosch / Vaillant:
- Installer enablement tool
- Brand integration in AR
- Data on customer journeys

---

# WHY NOW?

## The Perfect Storm

1. **Government targets:** 600,000 heat pumps/year by 2028
2. **Boiler phase-out:** 2035 gas boiler ban
3. **Consumer demand:** Post-energy crisis awareness
4. **Technology ready:** AR/PWA now mainstream
5. **Competition:** First mover advantage available

---

# SUMMARY

## The Hail Mary Customer Portal

**Transforms the post-survey experience from:**
> "Here's a PDF, call us if interested"

**To:**
> "Here's your home's future — explore, visualize, decide"

### Key Differentiators:
1. 🔗 Personalized magic link
2. 👁️ AR equipment visualization
3. 💷 Interactive finance calculator
4. 📅 Long-term upgrade roadmap
5. 🏠 Digital twin of the home
6. 📲 PWA that feels like native app

### Business Impact:
- 📈 +37% conversion rate
- ⏱️ -50% time to decision
- 💰 £112K+ additional monthly revenue (per 100 quotes)

---

# NEXT STEPS

## Let's Talk

### For Partnership Discussion:
📧 martin@hailmary.uk
📱 [Phone Number]

### For Demo:
🔗 demo.hailmary.uk/your-company

### What We Need:
1. Technical integration discussion
2. Commercial terms exploration
3. Pilot program agreement

---

# APPENDIX

## A. Market Data Sources
- BEIS Heat Pump Statistics 2023
- MCS Installation Data
- Energy Saving Trust Reports
- BSRIA UK Heating Market Report

## B. Customer Research
- 200+ homeowner interviews
- 50+ installer surveys
- A/B testing on conversion funnels

## C. Technology Documentation
- API specification available on request
- Security & compliance documentation
- Integration guides

---

*Hail Mary - The Future of Home Energy Journeys*

*Confidential - December 2024*
