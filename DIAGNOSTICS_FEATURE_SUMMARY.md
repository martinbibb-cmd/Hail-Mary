# Diagnostics UI Feature - Implementation Summary

## Overview
This feature implements a comprehensive diagnostics UI to help administrators quickly identify backend health issues, schema problems, and data presence. It provides instant visibility to distinguish between "UI hiding features" and "backend has no data/tables" scenarios.

## Features Implemented

### Backend API Endpoints (Admin-Only)

#### 1. GET /api/diagnostics/health
Returns aggregate health status:
- API status (always true if endpoint responds)
- Database connectivity check
- Assistant service reachability (3-second timeout)
- Schema version from migrations table
- Build information (SHA, timestamp)
- Server uptime and environment
- Node.js version

#### 2. GET /api/diagnostics/schema
Returns database schema information:
- List of all tables in the database
- Expected core tables list
- Missing tables (if any)
- Total table count
- Last 10 migrations (if available)

#### 3. GET /api/diagnostics/stats
Returns entity counts and recent activity:
- **Counts** for 15+ entity types:
  - Users, Accounts
  - Leads, Addresses, Appointments
  - Photos, Scans, Files, Assets
  - Properties, Visits, Timeline Events
  - Presentations, Bug Reports
- **Recent Activity**:
  - Last 10 leads created
  - Last 10 addresses created
  - Last 10 visits created

### Frontend PWA Interface

#### Status Tiles (Color-Coded)
- 🟢 **Green**: Service healthy/connected
- 🟡 **Amber**: Status unknown
- 🔴 **Red**: Service unavailable/disconnected

Four tiles display:
1. **API** - Always online if UI loads
2. **Database** - Connection status
3. **Assistant** - Reachability check
4. **Schema** - Missing tables count

#### System Information Panel
Displays:
- Environment (development/production)
- Node.js version
- Server uptime (in minutes)
- Build SHA (first 8 characters)
- Build timestamp
- Schema version

#### Database Schema Panel
Shows:
- Total tables in database
- Expected tables count
- Missing tables (if any) with warning styling

#### Entity Counts Grid
Responsive grid showing counts for all major entities:
- Visual with emojis for easy scanning
- Organized by category
- Updates on refresh

#### Recent Activity
Three sections showing:
- Recent Leads (name + date)
- Recent Addresses (postcode + date)
- Recent Visits (property ID + date)

#### Action Buttons
- **🔄 Refresh**: Reload all diagnostic data
- **📋 Copy Diagnostic Bundle**: Copy all diagnostic data as JSON for support

### Security

- All endpoints require authentication (`requireAuth`)
- All endpoints require admin role (`requireAdmin`)
- No sensitive data exposed (no credentials, connection strings)
- Read-only operations only
- Safe error handling with fallbacks

### Access Control

- **Frontend**: Diagnostics link visible only to admin users in Profile page
- **Backend**: All endpoints protected by admin middleware
- Returns 401 for unauthenticated requests
- Returns 403 for non-admin users

## File Structure

```
packages/api/src/
  └── routes/
      └── diagnostics.ts          # All backend diagnostics endpoints

packages/pwa/src/
  ├── App.tsx                     # Added /diagnostics route
  ├── os/apps/
  │   ├── profile/
  │   │   └── ProfileApp.tsx      # Added diagnostics link for admins
  │   └── diagnostics/
  │       ├── DiagnosticsApp.tsx  # Main diagnostics component
  │       └── DiagnosticsApp.css  # Styling
```

## Usage Instructions

### For Administrators

1. Log in with admin credentials
2. Navigate to Profile (settings icon)
3. Click "🔍 System Diagnostics"
4. View real-time health status
5. Scroll to see entity counts and activity
6. Click "Refresh" to reload data
7. Click "Copy Diagnostic Bundle" to share with support

### For Support/Debugging

When reporting issues:
1. Access diagnostics page
2. Click "Copy Diagnostic Bundle"
3. Paste the JSON into bug report or support ticket
4. The bundle includes:
   - Timestamp of capture
   - All health status
   - Schema information
   - Entity counts
   - Recent activity

## Benefits

1. **Instant Visibility**: No more guessing if the backend is the problem
2. **Schema Validation**: Quickly identify missing tables from migrations
3. **Data Presence**: See if empty screens are due to no data vs. UI bugs
4. **Support Tool**: Diagnostic bundle provides complete system snapshot
5. **Proactive Monitoring**: Admins can check health before users report issues

## Technical Notes

- Parallel API calls for fast loading
- Proper null handling throughout
- Error states with retry capability
- Responsive design for mobile/tablet
- Consistent with existing app styling
- No dependencies added (uses existing packages)

## Future Enhancements (Not Implemented)

The following were intentionally left out to keep the initial implementation simple:
- Migration execution button
- Manual seed data trigger
- Real-time monitoring/polling
- Alert history/logging
- Per-screen dependency checker
- Custom health check endpoints
