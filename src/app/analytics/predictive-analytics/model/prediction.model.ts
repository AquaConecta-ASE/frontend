// Backend API response interfaces (based on API_DOCUMENTATION_FRONTEND.md v2.0)
export interface PredictionResponse {
  subscriptionId?: number; // OPTIONAL: Each subscription has its own prediction (backend should provide this)
  residentId: number;
  predictionDate: string; // DateTime ISO string
  dailyAverageConsumption: number; // Litros per day
  currentWaterLevel: number; // Litros
  daysUntilRunout: number; // Días
  waterRunoutDate: string; // Date (YYYY-MM-DD)
  confidenceScore: number; // 0.0-1.0
  status: 'ACTIVE' | 'OUTDATED';
  totalPredictedConsumption7Days: number; // Litros
  next7DaysPredictions: DayPrediction[];
  refillInfo: RefillInfo;
}

export interface DayPrediction {
  date: string; // YYYY-MM-DD
  predictedConsumption: number; // Litros for that day
  dayOfWeek: string; // MONDAY, TUESDAY, etc.
}

export interface RefillInfo {
  refillsLast30Days: number;
  lastRefillDate: string; // YYYY-MM-DD
  daysSinceLastRefill: number;
}

export interface ConsumptionRecord {
  consumptionDate: string; // YYYY-MM-DD
  initialLevel: number; // Litros
  finalLevel: number; // Litros
  consumption: number; // Litros (0 if refill)
  waterQuality: string; // 'excellent', 'good', 'acceptable', 'fair', 'poor'
  isRefill: boolean;
  deviceId: number;
}

// Internal normalized model (for UI compatibility with existing code)
export interface Prediction {
  subscriptionId?: number; // OPTIONAL: Each subscription (tank) has its own prediction
  residentId: number;
  residentName?: string;
  subscriptionName?: string; // NEW: Name of the subscription/tank (e.g., "Tanque Principal")
  deviceId?: number;
  sensorId?: number;
  // Consumo estimado para el próximo periodo (litros o unidad definida)
  predictedConsumption: number;
  // Consumo estimado por día (opcional, calculado por el servicio)
  predictedConsumptionPerDay?: number;
  // Serie de valores (opcional) ordenada por fecha/periodo para graficar
  predictedSeries?: { date: string; value: number }[];
  // Probabilidad de necesitar reabastecimiento (0..1)
  restockProbability?: number;
  // Días estimados hasta que el recurso se agote
  predictedDaysUntilEmpty?: number;
  // Acción recomendada por el sistema
  recommendedAction?: 'none' | 'alert' | 'auto_restock';
  // Metadata opcional: confianza del modelo, ventana temporal usada, etc.
  metadata?: {
    confidence?: number;
    window?: string;
  };
  // New fields from backend API
  currentWaterLevel?: number; // Litros
  waterRunoutDate?: string; // YYYY-MM-DD
  totalPredictedConsumption7Days?: number;
  refillInfo?: RefillInfo;
  status?: 'ACTIVE' | 'OUTDATED';
  predictionDate?: string;
}
