export interface Prediction {
  residentId: number;
  residentName?: string;
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
}
