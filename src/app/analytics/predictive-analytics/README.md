# Predictive Analytics Module - Implementation Guide

## 📋 Overview

This module integrates the **Predictive Analytics Backend API** with the Angular frontend to display water consumption predictions, alerts, and recommendations for residents.

## ✅ Implemented Features

### 1. **Backend API Integration**
- ✅ `POST /api/v1/predictive/predictions/generate` - Generate new prediction
- ✅ `GET /api/v1/predictive/predictions/latest` - Get latest active prediction
- ✅ `GET /api/v1/predictive/consumption/history` - Get consumption history

### 2. **UI Features**
- ✅ Toggle between **Mock Data** and **Real API Data**
- ✅ View predictions for **all residents** or **specific resident**
- ✅ Display daily consumption chart (litros/day)
- ✅ Toggle to show **remaining stock** (decreasing series)
- ✅ Summary cards with key metrics:
  - Current water level
  - Days until empty
  - Daily average consumption
  - Last refill information
- ✅ Detailed predictions table with:
  - Current water level
  - Daily average consumption
  - Days until empty
  - Runout date
  - Recommended action
  - Model confidence

### 3. **Data Model**
The module uses a normalized internal `Prediction` model that supports both:
- **Mock data** (for testing/demo)
- **Backend API responses** (PredictionResponse)

Automatic conversion between backend response and internal model.

## 🚀 How to Use

### **1. Enable Real API Data**

By default, the module uses mock data. To enable real API data:

1. Make sure your backend is running at `http://localhost:8080`
2. In the UI, check the **"Usar datos reales (API)"** checkbox
3. The module will fetch predictions from the backend

### **2. View Predictions**

**For All Residents:**
- Leave the "Residente" dropdown on "Todos"
- The module will fetch predictions for all configured resident IDs

**For Specific Resident:**
- Select a resident from the dropdown
- The module will fetch only that resident's prediction
- Additional cards will show:
  - Current water level
  - Days until empty
  - Refill information

### **3. Generate New Prediction**

To generate a new prediction for a resident (calls backend):

```typescript
// In component or service
this.analyticsComponent.generatePrediction(residentId);
```

This will:
1. Call `POST /predictions/generate?residentId={id}`
2. Automatically reload predictions after generation
3. Mark previous predictions as OUTDATED

### **4. View Consumption History**

To load and view consumption history:

```typescript
// In component
this.analyticsComponent.loadConsumptionHistory(residentId);
// History will be stored in: this.consumptionHistory
```

## 🔧 Configuration

### **Backend URL**
Edit in `predictive-analytics.service.ts`:

```typescript
private basePath = 'http://localhost:8080/api/v1/predictive';
```

### **Available Residents**
The module tries to load resident IDs from `localStorage`:

```typescript
localStorage.setItem('available_residents', JSON.stringify([1, 2, 3, 4, 5]));
```

Or it defaults to `[1, 2, 3]`.

### **Authorization Token**
The service automatically reads the auth token from:

```typescript
localStorage.getItem('auth_token')
```

Make sure your authentication flow stores the token there.

## 📊 Data Flow

```
┌─────────────────┐
│   Component     │
│   (UI Layer)    │
└────────┬────────┘
         │
         │ useMockData = false
         │
         ▼
┌─────────────────────┐
│  Analytics Service  │
│  (HTTP Layer)       │
└────────┬────────────┘
         │
         │ HTTP GET/POST
         │
         ▼
┌─────────────────────┐
│   Backend API       │
│  (localhost:8080)   │
└─────────────────────┘
```

### **Response Normalization**

```typescript
PredictionResponse (Backend)
         │
         │ convertBackendResponseToInternal()
         │
         ▼
Prediction (Internal Model)
         │
         │ UI Rendering
         │
         ▼
   Angular Template
```

## 🎨 UI Components

### **Summary Cards**
- Show key metrics at a glance
- Adapt based on selected resident
- Display backend data fields

### **Prediction Chart**
- Line chart showing daily consumption over time
- Uses Chart.js
- X-axis: Dates (YYYY-MM-DD)
- Y-axis: Consumption (L/day) or Remaining Stock (L)
- Toggle between consumption and remaining stock view

### **Predictions Table**
- Lists all predictions with details
- Shows:
  - Current water level
  - Daily average consumption
  - Days until empty
  - Runout date
  - Recommended action (none/alert/auto_restock)
  - Model confidence (%)

### **Refill Info Section**
- Only shows when a single resident is selected
- Displays:
  - Number of refills in last 30 days
  - Last refill date
  - Days since last refill

## 🔍 Example Usage

### **1. Basic Setup in Component**

```typescript
export class MyComponent {
  constructor(private analyticsService: PredictiveAnalyticsService) {}

  ngOnInit() {
    // Get latest prediction for resident
    this.analyticsService.getLatestPrediction(1).subscribe(prediction => {
      console.log('Prediction:', prediction);
    });
  }
}
```

### **2. Generate New Prediction**

```typescript
// Generate prediction and wait for result
this.analyticsService.generatePrediction(residentId).subscribe(result => {
  if (result) {
    console.log('Prediction generated:', result);
    console.log('Days until runout:', result.daysUntilRunout);
    console.log('Current level:', result.currentWaterLevel, 'L');
  }
});
```

### **3. Load Consumption History**

```typescript
this.analyticsService.getConsumptionHistory(residentId).subscribe(history => {
  // Filter normal days (no refills)
  const normalDays = history.filter(h => !h.isRefill);
  
  // Filter refill days
  const refills = history.filter(h => h.isRefill);
  
  console.log('Normal consumption days:', normalDays.length);
  console.log('Refills:', refills.length);
});
```

## ⚠️ Important Notes

### **Units**
All values from the backend are in **Litros (L)**:
- `currentWaterLevel`: Liters
- `dailyAverageConsumption`: Liters per day
- `predictedConsumption`: Liters
- `consumption` (history): Liters

### **Date Format**
Dates are in **ISO format** (YYYY-MM-DD):
- `waterRunoutDate`: "2025-11-16"
- `lastRefillDate`: "2025-11-01"
- `date` (in predictions): "2025-11-06"

### **Confidence Score**
Backend returns confidence as **0.0 to 1.0** (e.g., 0.93 = 93%).
The UI automatically converts to percentage for display.

### **Error Handling**
The service includes automatic error handling:
- Returns `null` for failed prediction requests
- Returns `[]` for failed history requests
- Logs errors to console
- Shows error message in UI

## 🧪 Testing

### **With Mock Data**
1. Leave "Usar datos reales (API)" unchecked
2. Mock data will show 3 sample residents
3. All features work with mock data

### **With Real Backend**
1. Start backend: `./mvnw spring-boot:run`
2. Check "Usar datos reales (API)"
3. Select a resident from dropdown
4. Verify data loads from API

### **Generate Prediction**
1. Open browser console
2. Run: `component.generatePrediction(1)`
3. Check backend logs for prediction generation
4. Verify UI updates with new prediction

## 📝 TODO / Future Enhancements

- [ ] Add consumption history chart
- [ ] Add export to PDF/CSV functionality
- [ ] Add real-time updates via WebSocket
- [ ] Add prediction comparison (current vs previous)
- [ ] Add batch prediction generation for all residents
- [ ] Add filtering by quality/level thresholds
- [ ] Add notifications when water level is critical

## 🐛 Troubleshooting

### **"No prediction available"**
- Check that backend is running
- Verify resident has at least 7 days of consumption data
- Check browser console for API errors
- Verify auth token is present in localStorage

### **"Error loading predictions from API"**
- Check backend URL in service
- Verify CORS is enabled on backend
- Check network tab for failed requests
- Verify JWT token is valid

### **Chart not showing**
- Check browser console for Chart.js errors
- Verify predictions array has data
- Check that predictedSeries exists and has values
- Try toggling between mock and real data

## 📚 References

- Backend API Documentation: `API_DOCUMENTATION_FRONTEND.md`
- Chart.js Documentation: https://www.chartjs.org/
- Angular HttpClient: https://angular.io/guide/http
