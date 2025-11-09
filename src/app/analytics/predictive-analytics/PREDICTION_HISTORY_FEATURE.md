# Prediction History Feature

## Overview
Added a comprehensive prediction history feature that allows users to view all historical predictions for each subscription, with clear distinction between **ACTIVE** and **OUTDATED** predictions.

## Backend Endpoint
**New Endpoint Added:**
```
GET /api/v1/predictive-analytics/subscriptions/{subscriptionId}/predictions/history?residentId={residentId}
```

**Expected Response:** Array of `PredictionResponse` objects, each containing:
- All standard prediction fields
- `status` field: "ACTIVE" or "OUTDATED"
- `predictionDate` field: When the prediction was generated

## Frontend Implementation

### 1. Service Layer (`predictive-analytics.service.ts`)
Added new method:
```typescript
getPredictionHistory(subscriptionId: number, residentId: number): Observable<PredictionResponse[]>
```

### 2. Component Logic (`predictive-analytics.component.ts`)
**New Properties:**
- `predictionHistory: Prediction[]` - Stores all historical predictions
- `showPredictionHistory: boolean` - Toggle for history visibility

**New Methods:**
- `loadPredictionHistory(subscriptionId)` - Loads all predictions for a subscription
- `togglePredictionHistory()` - Shows/hides history section
- `viewHistoricalPrediction(prediction)` - Allows viewing details of past predictions

**Auto-loading:**
- When a subscription is selected, the history automatically loads in the background
- History is cleared when changing subscriptions or residents

### 3. UI Components (`predictive-analytics.component.html`)
**New Section Added:**
- History toggle button with expand/collapse functionality
- Grid display of all historical predictions
- Each card shows:
  - Status badge (ACTIVE in green, OUTDATED in red)
  - Prediction generation date
  - Key metrics: Current Level, Daily Avg, Days Until Empty, Runout Date, 7-Day Total, Confidence
  - "View Details" button to load that prediction into the main chart

### 4. Styling (`predictive-analytics.component.css`)
**New Styles:**
- `.prediction-history-section` - Container for the entire history feature
- `.history-grid` - Responsive grid layout for history cards
- `.history-card` - Individual prediction card with hover effects
- `.active-prediction` - Green-themed styling for active predictions
- `.outdated-prediction` - Red-themed styling for outdated predictions
- `.history-status-badge` - Status indicator with color coding
- Responsive breakpoints for mobile devices

## User Flow

1. **Select Resident** → Loads all subscriptions
2. **Select Subscription** → Loads prediction history automatically
3. **Click "Show History"** → Expands history section
4. **View History Cards** → See all predictions with ACTIVE/OUTDATED status
5. **Click "View Details"** → Loads historical prediction data into the main chart and summary cards

## Visual Design

### Status Badges
- **ACTIVE**: Green badge (#10b981) - Current valid prediction
- **OUTDATED**: Red badge (#ef4444) - Past prediction that's no longer current

### Card Colors
- **Active Cards**: Light green gradient background with green border
- **Outdated Cards**: Light red gradient background with red border
- **Hover Effect**: Elevates card with blue border and shadow

## Features

✅ **Automatic Loading** - History loads when subscription is selected
✅ **Status Indication** - Clear visual distinction between active and outdated predictions
✅ **Collapsible Section** - Toggle to show/hide history to reduce clutter
✅ **Interactive Cards** - Click to view historical prediction details
✅ **Responsive Design** - Adapts to mobile screens
✅ **Comprehensive Metrics** - Shows all key prediction data in compact format
✅ **Date Tracking** - Displays when each prediction was generated

## Backend Requirements

The backend should return an array of predictions sorted by `predictionDate` (newest first recommended) with:
```json
[
  {
    "residentId": 1,
    "subscriptionId": 5,
    "predictionDate": "2025-11-06T19:46:04.114512",
    "status": "ACTIVE",
    "dailyAverageConsumption": 0.75,
    "currentWaterLevel": 8.52,
    "daysUntilRunout": 12,
    "waterRunoutDate": "2025-11-17",
    "confidenceScore": 0.93,
    "totalPredictedConsumption7Days": 5.04,
    "next7DaysPredictions": [...],
    "refillInfo": {...}
  },
  {
    "residentId": 1,
    "subscriptionId": 5,
    "predictionDate": "2025-11-01T10:30:00.000000",
    "status": "OUTDATED",
    ...
  }
]
```

## Testing Checklist

- [ ] Verify history loads when subscription is selected
- [ ] Check that ACTIVE predictions show green styling
- [ ] Check that OUTDATED predictions show red styling
- [ ] Test toggle button expands/collapses history
- [ ] Click "View Details" on historical prediction loads it into chart
- [ ] Verify responsive layout on mobile devices
- [ ] Test with subscriptions that have no history (should show empty state)
- [ ] Test with subscriptions that have multiple predictions
- [ ] Verify history clears when changing subscriptions

## Notes

- The system maintains backward compatibility - if backend doesn't support history endpoint, feature gracefully fails
- Empty state message displayed when no historical predictions exist
- History is per-subscription, not per-resident (each tank has its own history)
- Clicking on historical prediction updates the main chart to show that prediction's forecast
