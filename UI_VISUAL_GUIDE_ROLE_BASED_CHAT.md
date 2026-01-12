# Visual UI Guide: Role-Based Chat Transcript

## Overview
This document provides a visual description of the role-based chat transcript interface implemented for the Visit Notes feature in Hail Mary Atlas.

## Layout

The transcript feed appears in the left panel of the 3-panel Visit view:

```
┌─────────────────────────────────────────────────────────────────┐
│                    🎙️ Active Visit                              │
│  [Import media]  [Export JSON]  [Save]  [End Visit]             │
├─────────────┬──────────────────┬─────────────────────────────────┤
│             │                  │                                 │
│ TRANSCRIPT  │   CHECKLIST      │    KEY DETAILS                  │
│ FEED        │                  │                                 │
│ (Left)      │   (Center)       │    (Right)                      │
│             │                  │                                 │
└─────────────┴──────────────────┴─────────────────────────────────┘
```

## Transcript Feed Header

```
┌──────────────────────────────────────────────────┐
│  📝 Live transcript    [👨‍🔧 Expert] [👤 Customer] │
└──────────────────────────────────────────────────┘
```

### Role Selector Buttons
- **Expert Button**: `👨‍🔧 Expert` (surveyor/engineer mode)
  - Default/active: Blue background (#007AFF)
  - Inactive: White background with border
  - Hover: Light gray background

- **Customer Button**: `👤 Customer` (homeowner mode)
  - Active: Blue background (#007AFF)
  - Inactive: White background with border
  - Hover: Light gray background

## Message Bubbles

### Expert Message (Light Green)
```
┌────────────────────────────────────────────────┐
│ 👨‍🔧 Expert                      14:23:45      │
│                                                 │
│ The boiler is approximately 12 years old       │
│ and appears to be a Worcester Bosch combi.     │
│                                                 │
│                           [⇄ Switch Role]      │
└────────────────────────────────────────────────┘
```
- Background: `rgba(144, 238, 144, 0.2)` (light green)
- Border: `rgba(144, 238, 144, 0.4)`
- Icon: 👨‍🔧 (construction worker/engineer emoji)

### Customer Message (Light Blue)
```
┌────────────────────────────────────────────────┐
│ 👤 Customer                     14:24:12       │
│                                                 │
│ How much will a replacement cost?              │
│                                                 │
│                           [⇄ Switch Role]      │
└────────────────────────────────────────────────┘
```
- Background: `rgba(173, 216, 230, 0.2)` (light blue)
- Border: `rgba(173, 216, 230, 0.4)`
- Icon: 👤 (person emoji)

## Message Components

Each transcript segment includes:

1. **Header Row**
   - Role icon + label (left aligned)
   - Timestamp in HH:MM:SS format (right aligned)

2. **Message Text**
   - Full transcript text
   - Readable font size (13px)
   - Good line height (1.5)

3. **Switch Role Button**
   - Small button at bottom right
   - Text: "⇄ Switch Role"
   - Allows correcting misattributed messages
   - Only visible when onRoleSwitch callback is provided

## Color Scheme

### Role Indicators
| Role     | Icon  | Background Color              | Border Color                  |
|----------|-------|-------------------------------|-------------------------------|
| Expert   | 👨‍🔧   | rgba(144, 238, 144, 0.2)      | rgba(144, 238, 144, 0.4)      |
| Customer | 👤    | rgba(173, 216, 230, 0.2)      | rgba(173, 216, 230, 0.4)      |

### Button States
| State    | Background    | Text Color   | Border        |
|----------|---------------|--------------|---------------|
| Active   | #007AFF       | white        | #007AFF       |
| Inactive | white         | rgba(0,0,0,0.88) | rgba(0,0,0,0.15) |
| Hover    | rgba(0,0,0,0.04) | rgba(0,0,0,0.88) | rgba(0,0,0,0.25) |

## Full Transcript View Example

```
┌─────────────────────────────────────────────────────────┐
│  📝 Live transcript       [👨‍🔧 Expert] [👤 Customer]    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ 👨‍🔧 Expert                    14:23:45        │    │
│  │                                                 │    │
│  │ The boiler is approximately 12 years old       │    │
│  │ and appears to be a Worcester Bosch combi.     │    │
│  │                           [⇄ Switch Role]      │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ 👤 Customer                   14:24:12         │    │
│  │                                                 │    │
│  │ How much will a replacement cost?              │    │
│  │                           [⇄ Switch Role]      │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ 👨‍🔧 Expert                    14:24:45        │    │
│  │                                                 │    │
│  │ Based on the property size and your needs,     │    │
│  │ we estimate between £2,500 and £3,200          │    │
│  │ including installation.                         │    │
│  │                           [⇄ Switch Role]      │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ 👤 Customer                   14:25:03         │    │
│  │                                                 │    │
│  │ That sounds reasonable. What's the timeline?   │    │
│  │                           [⇄ Switch Role]      │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Empty State

When no transcript segments are available:

```
┌─────────────────────────────────────────────────────────┐
│  📝 Live transcript       [👨‍🔧 Expert] [👤 Customer]    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│              Waiting for transcript segments…           │
│                                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Interaction Flow

### 1. Starting a Visit
1. User clicks "Start Visit" for a lead
2. Transcript feed initializes with role selector
3. Default role is "Expert" (surveyor)
4. Recording can begin immediately

### 2. Switching Roles
1. User clicks "Customer" button before customer speaks
2. Button becomes active (blue background)
3. New transcript segments tagged as 'customer'
4. Messages appear with light blue background

### 3. Correcting a Misattributed Message
1. User notices a customer message was recorded while in Expert mode
2. User clicks "⇄ Switch Role" button on that segment
3. Segment instantly updates with new role styling
4. Role metadata updated in transcriptionStore

### 4. During Navigation
1. User navigates to another screen (e.g., Property)
2. Role selection persists in transcriptionStore
3. User returns to Visit Notes
4. Same role is still active
5. All previous segments retained with correct roles

## Accessibility Features

### Visual Clarity
- High contrast between expert (green) and customer (blue)
- Clear role icons (👨‍🔧 vs 👤)
- Sufficient color saturation even in light backgrounds
- Large clickable areas for role buttons

### Screen Reader Support
- Buttons have descriptive titles
- Role labels are text-based, not icon-only
- Semantic HTML structure

### Keyboard Navigation
- Role selector buttons are keyboard accessible
- Tab order: Expert button → Customer button → Transcript segments
- Switch Role buttons are focusable

## Mobile Considerations

The design is responsive:
- Role selector remains visible in header
- Message bubbles stack vertically
- Switch Role button moves to edge for thumb reach
- Touch targets are large enough (minimum 44x44px)

## Animation

Subtle animations enhance the experience:

1. **New Message Slide-in**: 0.2s ease-out from top (-4px)
2. **Button Hover**: 0.2s transition for background and border
3. **Role Switch**: Instant background color change

## Summary

The role-based chat interface provides:
- ✅ Clear visual distinction between expert and customer
- ✅ Easy role switching with prominent buttons
- ✅ Manual correction capability for misattributed messages
- ✅ Persistent role selection across navigation
- ✅ Accessible design for deaf customers
- ✅ Clean, professional appearance matching Atlas design system
