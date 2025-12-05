# Hail Mary Customer Portal - JSON API Specification

## Overview

This document defines the REST API that powers the Customer Portal PWA. The API enables personalized access via magic links, delivers roadmap data, powers AR visualizations, and handles finance calculations.

**Base URL:** `https://api.hailmary.uk/v1/portal`

**Authentication:** Magic Link Token (Bearer Token)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Customer Profile](#2-customer-profile)
3. [Property & Systems](#3-property--systems)
4. [Roadmap & Upgrades](#4-roadmap--upgrades)
5. [Finance & Quotes](#5-finance--quotes)
6. [AR & Visualisation](#6-ar--visualisation)
7. [Documents](#7-documents)
8. [Appointments](#8-appointments)
9. [Notifications](#9-notifications)
10. [Analytics](#10-analytics)

---

## 1. Authentication

### Generate Magic Link

Creates a new magic link for customer portal access.

**POST** `/auth/magic-link`

```json
// Request
{
  "customerId": "cust_abc123",
  "expiresInDays": 365,
  "notifyCustomer": true,
  "notificationChannel": "email"
}

// Response
{
  "success": true,
  "data": {
    "token": "AB3X9-JONES",
    "url": "https://portal.hailmary.uk/AB3X9-JONES",
    "expiresAt": "2025-12-05T00:00:00Z",
    "notificationSent": true
  }
}
```

### Validate Token

Validates a magic link token and returns session info.

**POST** `/auth/validate`

```json
// Request
{
  "token": "AB3X9-JONES"
}

// Response
{
  "success": true,
  "data": {
    "valid": true,
    "customerId": "cust_abc123",
    "customerName": "Sarah Jones",
    "propertyId": "prop_xyz789",
    "expiresAt": "2025-12-05T00:00:00Z",
    "lastAccessed": "2024-12-01T14:30:00Z",
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Refresh Token

**POST** `/auth/refresh`

```json
// Request (Authorization header required)
{}

// Response
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

---

## 2. Customer Profile

### Get Customer Profile

**GET** `/customer`

```json
// Response
{
  "success": true,
  "data": {
    "id": "cust_abc123",
    "firstName": "Sarah",
    "lastName": "Jones",
    "email": "sarah.jones@example.com",
    "phone": "+447700123456",
    "preferences": {
      "notifications": {
        "email": true,
        "sms": true,
        "push": true
      },
      "language": "en-GB",
      "units": "metric"
    },
    "createdAt": "2024-06-15T10:30:00Z",
    "updatedAt": "2024-12-01T14:30:00Z"
  }
}
```

### Update Customer Preferences

**PATCH** `/customer/preferences`

```json
// Request
{
  "notifications": {
    "email": true,
    "sms": false,
    "push": true
  }
}

// Response
{
  "success": true,
  "data": {
    "preferences": {
      "notifications": {
        "email": true,
        "sms": false,
        "push": true
      },
      "language": "en-GB",
      "units": "metric"
    }
  }
}
```

---

## 3. Property & Systems

### Get Property Details

**GET** `/property`

```json
// Response
{
  "success": true,
  "data": {
    "id": "prop_xyz789",
    "address": {
      "line1": "42 Oak Lane",
      "line2": null,
      "city": "Bristol",
      "postcode": "BS1 4AB",
      "country": "UK",
      "coordinates": {
        "lat": 51.4545,
        "lng": -2.5879
      }
    },
    "type": "semi_detached",
    "bedrooms": 3,
    "bathrooms": 2,
    "floorArea": 95,
    "floorAreaUnit": "sqm",
    "builtYear": "1960s",
    "construction": {
      "wallType": "cavity",
      "roofType": "pitched_tiles",
      "glazing": "double"
    },
    "epc": {
      "rating": "D",
      "score": 58,
      "potentialRating": "B",
      "potentialScore": 81,
      "certificateUrl": "/documents/epc-123.pdf",
      "validUntil": "2033-06-15"
    },
    "images": [
      {
        "id": "img_001",
        "url": "/images/properties/prop_xyz789/front.jpg",
        "type": "exterior_front",
        "isPrimary": true
      }
    ],
    "surveyDate": "2024-11-15T10:00:00Z",
    "surveyId": "srv_456def"
  }
}
```

### Get Current Systems

**GET** `/property/systems`

```json
// Response
{
  "success": true,
  "data": {
    "systems": [
      {
        "id": "sys_001",
        "type": "heating",
        "category": "gas_combi_boiler",
        "make": "Worcester Bosch",
        "model": "Greenstar 30i",
        "installedDate": "2009-03-15",
        "age": 15,
        "status": "aging",
        "statusReason": "Boiler is over 15 years old",
        "efficiency": 89,
        "fuelType": "mains_gas",
        "output": 30,
        "outputUnit": "kW",
        "notes": "Annual service due"
      },
      {
        "id": "sys_002",
        "type": "hot_water",
        "category": "from_combi",
        "relatedSystemId": "sys_001",
        "notes": "Served by combi boiler"
      },
      {
        "id": "sys_003",
        "type": "controls",
        "category": "smart_thermostat",
        "make": "Hive",
        "model": "Thermostat V3",
        "installedDate": "2023-06-10",
        "status": "good"
      }
    ],
    "summary": {
      "heatingType": "Gas Combi Boiler",
      "heatingAge": 15,
      "heatingStatus": "aging",
      "hotWaterType": "From Combi",
      "solarInstalled": false,
      "evChargerInstalled": false,
      "batteryInstalled": false
    }
  }
}
```

---

## 4. Roadmap & Upgrades

### Get Full Roadmap

**GET** `/roadmap`

```json
// Response
{
  "success": true,
  "data": {
    "phases": [
      {
        "id": "today",
        "label": "Today",
        "yearRange": null,
        "items": [
          {
            "id": "item_001",
            "type": "current_system",
            "systemId": "sys_001",
            "status": "aging",
            "recommendation": "Plan replacement within 0-2 years"
          }
        ]
      },
      {
        "id": "phase_0_2",
        "label": "0-2 Years",
        "yearRange": { "from": 0, "to": 2 },
        "items": [
          {
            "id": "upgrade_hp_001",
            "type": "heat_pump",
            "title": "Heat Pump Installation",
            "description": "Replace gas boiler with air source heat pump",
            "priority": "high",
            "product": {
              "make": "Vaillant",
              "model": "aroTHERM Plus 7kW",
              "sku": "VT-ATP-7"
            },
            "pricing": {
              "grossCost": 12500,
              "grants": [
                {
                  "name": "Boiler Upgrade Scheme",
                  "type": "BUS",
                  "amount": 7500,
                  "status": "available"
                }
              ],
              "totalGrants": 7500,
              "netCost": 5000
            },
            "benefits": {
              "annualSavings": 340,
              "co2ReductionTonnes": 2.1,
              "efficiencyGain": 300
            },
            "status": "recommended",
            "interest": false,
            "arModelId": "model_hp_indoor_001",
            "actions": ["view_details", "view_ar", "view_finance", "express_interest"]
          },
          {
            "id": "upgrade_cyl_001",
            "type": "cylinder",
            "title": "HP-Ready Cylinder",
            "description": "Upgrade hot water storage for heat pump compatibility",
            "priority": "high",
            "bundleWith": "upgrade_hp_001",
            "product": {
              "make": "Megaflo",
              "model": "Eco Plus 210L",
              "sku": "MF-EP-210"
            },
            "pricing": {
              "grossCost": 1200,
              "grants": [],
              "totalGrants": 0,
              "netCost": 1200
            },
            "benefits": {
              "annualSavings": 0,
              "co2ReductionTonnes": 0
            },
            "status": "recommended"
          }
        ]
      },
      {
        "id": "phase_2_5",
        "label": "2-5 Years",
        "yearRange": { "from": 2, "to": 5 },
        "items": [
          {
            "id": "upgrade_pv_001",
            "type": "solar_pv",
            "title": "Solar PV System",
            "description": "4.2kWp rooftop solar installation",
            "priority": "medium",
            "product": {
              "make": "JA Solar",
              "model": "12x JAM54S30-350",
              "capacity": 4.2,
              "capacityUnit": "kWp",
              "panels": 12
            },
            "pricing": {
              "grossCost": 6800,
              "grants": [],
              "totalGrants": 0,
              "netCost": 6800
            },
            "benefits": {
              "annualSavings": 520,
              "co2ReductionTonnes": 1.4,
              "annualGeneration": 3800,
              "generationUnit": "kWh"
            },
            "status": "future",
            "interest": true
          }
        ]
      },
      {
        "id": "phase_5_15",
        "label": "5-15 Years",
        "yearRange": { "from": 5, "to": 15 },
        "items": [
          {
            "id": "upgrade_bat_001",
            "type": "battery",
            "title": "Battery Storage",
            "description": "Store excess PV generation",
            "priority": "low",
            "status": "future",
            "interest": false
          },
          {
            "id": "upgrade_ev_001",
            "type": "ev_charger",
            "title": "EV Charger",
            "description": "Home charging point",
            "priority": "low",
            "status": "future",
            "interest": false
          }
        ]
      }
    ],
    "summary": {
      "totalUpgrades": 5,
      "totalInvestment": 20500,
      "totalGrants": 7500,
      "totalNetCost": 13000,
      "totalAnnualSavings": 860,
      "totalCo2Reduction": 3.5,
      "paybackYears": 7.5
    },
    "lastUpdated": "2024-12-01T10:00:00Z"
  }
}
```

### Get Upgrade Details

**GET** `/roadmap/upgrades/{upgradeId}`

```json
// Response
{
  "success": true,
  "data": {
    "id": "upgrade_hp_001",
    "type": "heat_pump",
    "title": "Heat Pump Installation",
    "description": "Replace gas boiler with air source heat pump",
    "longDescription": "An air source heat pump extracts heat from the outside air to heat your home and hot water. With a COP of 3.0-4.0, it delivers 3-4 units of heat for every unit of electricity used.",
    "priority": "high",
    "phase": "phase_0_2",
    "product": {
      "make": "Vaillant",
      "model": "aroTHERM Plus 7kW",
      "sku": "VT-ATP-7",
      "specifications": {
        "capacity": 7,
        "capacityUnit": "kW",
        "cop": 4.2,
        "dimensions": {
          "indoor": { "width": 440, "height": 850, "depth": 350 },
          "outdoor": { "width": 1100, "height": 1200, "depth": 450 }
        },
        "noise": 52,
        "noiseUnit": "dB(A)",
        "refrigerant": "R290",
        "warranty": 7
      },
      "datasheet": "/documents/vaillant-arotherm-plus-datasheet.pdf",
      "images": [
        "/images/products/vaillant-arotherm-indoor.jpg",
        "/images/products/vaillant-arotherm-outdoor.jpg"
      ]
    },
    "pricing": {
      "grossCost": 12500,
      "breakdown": [
        { "item": "Heat pump unit", "cost": 6500 },
        { "item": "Indoor unit", "cost": 1500 },
        { "item": "Installation labour", "cost": 3000 },
        { "item": "Electrical work", "cost": 800 },
        { "item": "Commissioning", "cost": 700 }
      ],
      "grants": [
        {
          "name": "Boiler Upgrade Scheme",
          "type": "BUS",
          "amount": 7500,
          "status": "available",
          "eligibility": "confirmed",
          "expiryDate": "2025-03-31"
        }
      ],
      "totalGrants": 7500,
      "netCost": 5000,
      "vatIncluded": true
    },
    "benefits": {
      "annualSavings": 340,
      "savingsBreakdown": {
        "currentAnnualCost": 1840,
        "projectedAnnualCost": 1500,
        "fuelSavings": 340
      },
      "co2ReductionTonnes": 2.1,
      "co2Breakdown": {
        "currentCo2": 4.2,
        "projectedCo2": 2.1,
        "reduction": 2.1
      },
      "efficiencyGain": 300,
      "comfortImprovements": [
        "More consistent heating",
        "Quieter operation",
        "Better temperature control"
      ]
    },
    "installation": {
      "estimatedDuration": 2,
      "durationUnit": "days",
      "disruption": "moderate",
      "requirements": [
        "External wall space for outdoor unit",
        "Internal space for cylinder",
        "Electrical capacity check"
      ],
      "preparation": [
        "Clear access to boiler location",
        "Ensure outdoor unit location is accessible"
      ]
    },
    "status": "recommended",
    "interest": false,
    "ar": {
      "models": [
        {
          "id": "model_hp_indoor_001",
          "type": "indoor_unit",
          "url": "/models/vaillant-arotherm-indoor.glb",
          "thumbnail": "/images/ar-thumbnails/hp-indoor.jpg"
        },
        {
          "id": "model_hp_outdoor_001",
          "type": "outdoor_unit",
          "url": "/models/vaillant-arotherm-outdoor.glb",
          "thumbnail": "/images/ar-thumbnails/hp-outdoor.jpg"
        }
      ],
      "markers": [
        {
          "id": "marker_hp_indoor",
          "aruco_id": 1,
          "label": "Heat Pump Indoor Unit",
          "modelId": "model_hp_indoor_001"
        },
        {
          "id": "marker_hp_outdoor",
          "aruco_id": 2,
          "label": "Heat Pump Outdoor Unit",
          "modelId": "model_hp_outdoor_001"
        }
      ]
    },
    "relatedUpgrades": ["upgrade_cyl_001"],
    "faqs": [
      {
        "question": "How noisy is a heat pump?",
        "answer": "Modern heat pumps are very quiet - typically 45-55 dB(A), similar to a fridge."
      },
      {
        "question": "Will my radiators need replacing?",
        "answer": "Often no - we'll assess during survey. Some homes need 1-2 larger radiators."
      }
    ]
  }
}
```

### Update Interest Status

**PATCH** `/roadmap/upgrades/{upgradeId}/interest`

```json
// Request
{
  "interested": true
}

// Response
{
  "success": true,
  "data": {
    "upgradeId": "upgrade_pv_001",
    "interested": true,
    "updatedAt": "2024-12-05T10:30:00Z"
  }
}
```

---

## 5. Finance & Quotes

### Get Quote Summary

**GET** `/finance/quote`

```json
// Response
{
  "success": true,
  "data": {
    "quoteId": "qt_789ghi",
    "quoteNumber": "HM-2024-1234",
    "status": "sent",
    "validUntil": "2025-01-15T23:59:59Z",
    "items": [
      {
        "id": "line_001",
        "upgradeId": "upgrade_hp_001",
        "description": "Vaillant aroTHERM Plus 7kW Heat Pump System",
        "quantity": 1,
        "unitPrice": 12500,
        "lineTotal": 12500
      },
      {
        "id": "line_002",
        "upgradeId": "upgrade_cyl_001",
        "description": "Megaflo Eco Plus 210L Cylinder",
        "quantity": 1,
        "unitPrice": 1200,
        "lineTotal": 1200
      }
    ],
    "subtotal": 13700,
    "vat": {
      "rate": 0,
      "amount": 0,
      "note": "0% VAT on energy saving materials"
    },
    "grossTotal": 13700,
    "grants": [
      {
        "name": "Boiler Upgrade Scheme",
        "type": "BUS",
        "amount": 7500,
        "status": "available"
      }
    ],
    "totalGrants": 7500,
    "netTotal": 6200,
    "paymentOptions": [
      {
        "id": "pay_full",
        "type": "full",
        "label": "Pay in Full",
        "amount": 6200,
        "discount": 124,
        "discountPercent": 2,
        "finalAmount": 6076
      },
      {
        "id": "pay_finance",
        "type": "finance",
        "label": "Finance",
        "deposit": 0,
        "apr": 9.9,
        "termMonths": 84,
        "monthlyPayment": 103,
        "totalPayable": 8652
      },
      {
        "id": "pay_staged",
        "type": "staged",
        "label": "Pay in Stages",
        "milestones": [
          { "stage": "Deposit", "percent": 30, "amount": 1860, "trigger": "on_order" },
          { "stage": "Installation", "percent": 40, "amount": 2480, "trigger": "installation_start" },
          { "stage": "Completion", "percent": 30, "amount": 1860, "trigger": "sign_off" }
        ]
      }
    ]
  }
}
```

### Calculate Finance Options

**POST** `/finance/calculate`

```json
// Request
{
  "loanAmount": 6200,
  "deposit": 1000,
  "termMonths": 84,
  "apr": 9.9
}

// Response
{
  "success": true,
  "data": {
    "loanAmount": 5200,
    "deposit": 1000,
    "termMonths": 84,
    "apr": 9.9,
    "monthlyPayment": 86.47,
    "totalInterest": 2063.48,
    "totalPayable": 7263.48,
    "effectiveRate": 10.38,
    "schedule": [
      { "month": 1, "payment": 86.47, "principal": 43.56, "interest": 42.91, "balance": 5156.44 },
      { "month": 2, "payment": 86.47, "principal": 43.92, "interest": 42.55, "balance": 5112.52 }
      // ... remaining months
    ]
  }
}
```

### Get ROI Calculation

**GET** `/finance/roi`

Query params: `?upgradeIds=upgrade_hp_001,upgrade_pv_001&years=15`

```json
// Response
{
  "success": true,
  "data": {
    "scenarios": [
      {
        "id": "current",
        "label": "Current System (Gas Boiler)",
        "annualCost": 1840,
        "cumulativeCosts": [
          { "year": 0, "cost": 0 },
          { "year": 1, "cost": 1840 },
          { "year": 5, "cost": 9200 },
          { "year": 10, "cost": 18400 },
          { "year": 15, "cost": 27600 }
        ]
      },
      {
        "id": "proposed",
        "label": "Heat Pump + Solar PV",
        "initialCost": 13000,
        "annualCost": 980,
        "cumulativeCosts": [
          { "year": 0, "cost": 13000 },
          { "year": 1, "cost": 13980 },
          { "year": 5, "cost": 17900 },
          { "year": 10, "cost": 22800 },
          { "year": 15, "cost": 27700 }
        ]
      }
    ],
    "breakEvenYear": 6.2,
    "savingsAtYear15": 6340,
    "assumptions": {
      "gasPrice": 0.072,
      "gasPriceUnit": "GBP/kWh",
      "electricityPrice": 0.24,
      "electricityPriceUnit": "GBP/kWh",
      "gasPriceInflation": 0.03,
      "electricityPriceInflation": 0.02,
      "heatPumpCOP": 3.2
    }
  }
}
```

### Get Carbon Savings

**GET** `/finance/carbon`

```json
// Response
{
  "success": true,
  "data": {
    "annual": {
      "totalReduction": 2.1,
      "unit": "tonnes CO2",
      "breakdown": [
        { "upgrade": "Heat Pump", "reduction": 1.4, "percentage": 67 },
        { "upgrade": "Solar PV", "reduction": 0.5, "percentage": 24 },
        { "upgrade": "Improved Controls", "reduction": 0.2, "percentage": 9 }
      ]
    },
    "lifetime": {
      "years": 15,
      "totalReduction": 31.5,
      "unit": "tonnes CO2"
    },
    "equivalents": [
      { "type": "trees", "icon": "🌳", "value": 720, "label": "Trees planted" },
      { "type": "miles", "icon": "🚗", "value": 78000, "label": "Miles not driven" },
      { "type": "flights", "icon": "✈️", "value": 18, "label": "London-NY flights" }
    ],
    "currentFootprint": {
      "annual": 4.2,
      "unit": "tonnes CO2",
      "rating": "high"
    },
    "projectedFootprint": {
      "annual": 2.1,
      "unit": "tonnes CO2",
      "rating": "medium",
      "reductionPercent": 50
    }
  }
}
```

---

## 6. AR & Visualisation

### Get AR Models

**GET** `/ar/models`

```json
// Response
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "model_hp_indoor_001",
        "type": "heat_pump_indoor",
        "label": "Heat Pump Indoor Unit",
        "upgradeId": "upgrade_hp_001",
        "url": "/models/vaillant-arotherm-indoor.glb",
        "thumbnail": "/images/ar-thumbnails/hp-indoor.jpg",
        "dimensions": {
          "width": 440,
          "height": 850,
          "depth": 350,
          "unit": "mm"
        },
        "placementType": "wall",
        "defaultScale": 1.0
      },
      {
        "id": "model_hp_outdoor_001",
        "type": "heat_pump_outdoor",
        "label": "Heat Pump Outdoor Unit",
        "upgradeId": "upgrade_hp_001",
        "url": "/models/vaillant-arotherm-outdoor.glb",
        "thumbnail": "/images/ar-thumbnails/hp-outdoor.jpg",
        "dimensions": {
          "width": 1100,
          "height": 1200,
          "depth": 450,
          "unit": "mm"
        },
        "placementType": "ground",
        "defaultScale": 1.0
      },
      {
        "id": "model_ev_charger_001",
        "type": "ev_charger",
        "label": "EV Charger",
        "upgradeId": "upgrade_ev_001",
        "url": "/models/ev-charger-generic.glb",
        "thumbnail": "/images/ar-thumbnails/ev-charger.jpg",
        "dimensions": {
          "width": 200,
          "height": 400,
          "depth": 120,
          "unit": "mm"
        },
        "placementType": "wall",
        "defaultScale": 1.0
      }
    ]
  }
}
```

### Get ArUco Markers

**GET** `/ar/markers`

```json
// Response
{
  "success": true,
  "data": {
    "markers": [
      {
        "id": "marker_001",
        "arucoId": 1,
        "dictionary": "ARUCO_4X4_50",
        "label": "Heat Pump Indoor Unit",
        "modelId": "model_hp_indoor_001",
        "instructions": [
          "Print this page at 100% scale",
          "Cut along the dotted line",
          "Place on wall where unit will be installed",
          "Open Hail Mary app and point camera at marker"
        ]
      },
      {
        "id": "marker_002",
        "arucoId": 2,
        "dictionary": "ARUCO_4X4_50",
        "label": "Heat Pump Outdoor Unit",
        "modelId": "model_hp_outdoor_001",
        "instructions": [
          "Print this page at 100% scale",
          "Place on ground/wall at proposed location",
          "Ensure marker is flat and visible"
        ]
      },
      {
        "id": "marker_003",
        "arucoId": 3,
        "dictionary": "ARUCO_4X4_50",
        "label": "EV Charger",
        "modelId": "model_ev_charger_001",
        "instructions": [
          "Print this page at 100% scale",
          "Place on wall near parking space"
        ]
      }
    ],
    "pdfDownloadUrl": "/ar/markers/download",
    "markerSize": {
      "width": 100,
      "height": 100,
      "unit": "mm"
    }
  }
}
```

### Download Marker PDF

**GET** `/ar/markers/download`

Returns: `application/pdf`

PDF contains:
- Cover page with instructions
- Individual marker pages for each equipment type
- QR code linking back to the app

### Save AR Placement

**POST** `/ar/placements`

```json
// Request
{
  "modelId": "model_hp_indoor_001",
  "position": { "x": 2.5, "y": 1.2, "z": 0.1 },
  "rotation": { "x": 0, "y": 0, "z": 0 },
  "scale": 1.0,
  "room": "utility_room",
  "notes": "Next to existing boiler",
  "screenshot": "data:image/jpeg;base64,..."
}

// Response
{
  "success": true,
  "data": {
    "id": "placement_001",
    "modelId": "model_hp_indoor_001",
    "position": { "x": 2.5, "y": 1.2, "z": 0.1 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "scale": 1.0,
    "room": "utility_room",
    "notes": "Next to existing boiler",
    "screenshotUrl": "/images/placements/placement_001.jpg",
    "createdAt": "2024-12-05T10:30:00Z"
  }
}
```

### Get Saved Placements

**GET** `/ar/placements`

```json
// Response
{
  "success": true,
  "data": {
    "placements": [
      {
        "id": "placement_001",
        "modelId": "model_hp_indoor_001",
        "model": {
          "label": "Heat Pump Indoor Unit"
        },
        "position": { "x": 2.5, "y": 1.2, "z": 0.1 },
        "room": "utility_room",
        "screenshotUrl": "/images/placements/placement_001.jpg",
        "createdAt": "2024-12-05T10:30:00Z"
      }
    ]
  }
}
```

---

## 7. Documents

### List Documents

**GET** `/documents`

```json
// Response
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc_001",
        "type": "quote",
        "name": "Heat Pump Quote HM-2024-1234",
        "description": "Formal quotation for heat pump installation",
        "mimeType": "application/pdf",
        "size": 245678,
        "url": "/documents/doc_001/download",
        "thumbnailUrl": "/documents/doc_001/thumbnail",
        "uploadedAt": "2024-11-20T14:30:00Z"
      },
      {
        "id": "doc_002",
        "type": "survey",
        "name": "Property Survey Report",
        "description": "Full property assessment",
        "mimeType": "application/pdf",
        "size": 1234567,
        "url": "/documents/doc_002/download",
        "uploadedAt": "2024-11-15T10:00:00Z"
      },
      {
        "id": "doc_003",
        "type": "certificate",
        "name": "EPC Certificate",
        "mimeType": "application/pdf",
        "size": 87654,
        "url": "/documents/doc_003/download",
        "uploadedAt": "2023-06-15T09:00:00Z"
      }
    ],
    "categories": [
      { "type": "quote", "count": 1 },
      { "type": "survey", "count": 1 },
      { "type": "certificate", "count": 1 },
      { "type": "warranty", "count": 0 },
      { "type": "invoice", "count": 0 }
    ]
  }
}
```

### Download Document

**GET** `/documents/{documentId}/download`

Returns: Document file with appropriate MIME type

---

## 8. Appointments

### List Appointments

**GET** `/appointments`

```json
// Response
{
  "success": true,
  "data": {
    "upcoming": [
      {
        "id": "apt_001",
        "type": "survey",
        "title": "Heat Pump Survey",
        "description": "Detailed assessment for heat pump installation",
        "scheduledAt": "2025-01-15T10:00:00Z",
        "duration": 120,
        "durationUnit": "minutes",
        "status": "confirmed",
        "engineer": {
          "name": "Mike Smith",
          "phone": "+447700987654",
          "photo": "/images/engineers/mike-smith.jpg"
        },
        "address": {
          "line1": "42 Oak Lane",
          "city": "Bristol",
          "postcode": "BS1 4AB"
        },
        "preparation": [
          "Ensure access to boiler/heating system",
          "Clear space around hot water cylinder if applicable",
          "Have recent energy bills available if possible"
        ],
        "actions": ["reschedule", "cancel", "get_directions"]
      }
    ],
    "past": [
      {
        "id": "apt_002",
        "type": "survey",
        "title": "Initial Property Survey",
        "scheduledAt": "2024-11-15T10:00:00Z",
        "status": "completed",
        "completedAt": "2024-11-15T12:30:00Z"
      }
    ]
  }
}
```

### Request Reschedule

**POST** `/appointments/{appointmentId}/reschedule`

```json
// Request
{
  "preferredDates": [
    "2025-01-20",
    "2025-01-21",
    "2025-01-22"
  ],
  "preferredTimeSlot": "morning",
  "notes": "Afternoon works better for me"
}

// Response
{
  "success": true,
  "data": {
    "requestId": "req_001",
    "status": "pending",
    "message": "Reschedule request submitted. We'll contact you within 24 hours."
  }
}
```

---

## 9. Notifications

### Get Notifications

**GET** `/notifications`

```json
// Response
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif_001",
        "type": "quote_update",
        "title": "Quote Updated",
        "message": "Your heat pump quote has been updated with new savings calculations.",
        "createdAt": "2024-12-01T10:00:00Z",
        "read": false,
        "actionUrl": "/finance/quote",
        "actionLabel": "View Quote"
      },
      {
        "id": "notif_002",
        "type": "appointment_reminder",
        "title": "Appointment Tomorrow",
        "message": "Reminder: Heat Pump Survey at 10:00 AM tomorrow.",
        "createdAt": "2024-12-04T18:00:00Z",
        "read": true,
        "actionUrl": "/appointments/apt_001",
        "actionLabel": "View Details"
      }
    ],
    "unreadCount": 1
  }
}
```

### Mark as Read

**PATCH** `/notifications/{notificationId}/read`

```json
// Response
{
  "success": true,
  "data": {
    "id": "notif_001",
    "read": true
  }
}
```

### Register Push Subscription

**POST** `/notifications/push/subscribe`

```json
// Request
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "deviceInfo": {
    "platform": "web",
    "browser": "chrome",
    "os": "android"
  }
}

// Response
{
  "success": true,
  "data": {
    "subscriptionId": "sub_001",
    "status": "active"
  }
}
```

---

## 10. Analytics

### Track Event

**POST** `/analytics/events`

```json
// Request
{
  "event": "page_view",
  "properties": {
    "page": "roadmap",
    "referrer": "home"
  }
}

// Event types:
// - page_view
// - upgrade_viewed
// - ar_started
// - ar_placement_saved
// - finance_calculated
// - document_downloaded
// - appointment_requested
// - interest_expressed

// Response
{
  "success": true
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "The access token is invalid or expired",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_TOKEN` | 401 | Token is invalid or expired |
| `TOKEN_EXPIRED` | 401 | Token has expired |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Rate Limits

| Endpoint Type | Rate Limit |
|--------------|------------|
| Authentication | 10/minute |
| Read operations | 100/minute |
| Write operations | 30/minute |
| File downloads | 20/minute |

---

## Webhooks (Installer-side)

The portal can trigger webhooks to the installer's system:

### Events

| Event | Trigger |
|-------|---------|
| `portal.accessed` | Customer opens portal |
| `interest.expressed` | Customer marks interest in upgrade |
| `appointment.requested` | Customer requests appointment |
| `quote.viewed` | Customer views formal quote |
| `ar.placement.saved` | Customer saves AR placement |

### Webhook Payload

```json
{
  "event": "interest.expressed",
  "timestamp": "2024-12-05T10:30:00Z",
  "data": {
    "customerId": "cust_abc123",
    "customerName": "Sarah Jones",
    "upgradeId": "upgrade_pv_001",
    "upgradeName": "Solar PV System"
  },
  "signature": "sha256=..."
}
```

---

*API Version: 1.0*
*Last Updated: December 2024*
