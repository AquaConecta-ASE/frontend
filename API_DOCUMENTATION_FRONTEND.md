# 📡 API Documentation - Predictive Analytics

## 🔄 Cambios en Endpoints de Predicciones

### ❌ **ENDPOINTS ANTIGUOS (YA NO EXISTEN)**
```
❌ GET  /api/v1/predictive-analytics/residents/{residentId}/predictions
❌ POST /api/v1/predictive-analytics/residents/{residentId}/predictionsd
❌ GET  /api/v1/predictive-analytics/residents/{residentId}/consumption-history
```

---

## ✅ **NUEVOS ENDPOINTS (USAR ESTOS)**

### **1. Obtener predicción de una suscripción (solo lectura)**
```http
GET /api/v1/predictive-analytics/subscriptions/{subscriptionId}/predictions?residentId={residentId}
```

**Descripción:**
- ✅ Solo obtiene predicción existente (no genera nueva)
- ✅ Retorna 404 si no existe
- ✅ Valida que la suscripción pertenezca al residente

**Ejemplo:**
```bash
GET /api/v1/predictive-analytics/subscriptions/1/predictions?residentId=1
Authorization: Bearer {token}
```

**Respuestas:**
```json
# 200 OK - Predicción encontrada
{
  "subscriptionId": 1,
  "residentId": 1,
  "predictionDate": "2025-11-06T10:30:00",
  "currentWaterLevel": 720.5,
  "daysUntilRunout": 8,
  "waterRunoutDate": "2025-11-14",
  "dailyAverageConsumption": 90.0,
  "confidenceScore": 0.85,
  "status": "ACTIVE",
  "next7DaysPredictions": [
    {
      "date": "2025-11-07",
      "predictedConsumption": 90.0,
      "dayOfWeek": "Thursday"
    }
  ],
  "refillInfo": {
    "refillsLast30Days": 2,
    "lastRefillDate": "2025-11-01",
    "daysSinceLastRefill": 5
  }
}

# 404 Not Found - No hay predicción activa
# 403 Forbidden - Suscripción no pertenece al residente
# 500 Internal Server Error
```

---

### **2. Generar nueva predicción (siempre crea)**
```http
POST /api/v1/predictive-analytics/subscriptions/{subscriptionId}/predictions?residentId={residentId}
```

**Descripción:**
- ✅ Siempre genera nueva predicción
- ✅ Marca predicciones anteriores como OUTDATED
- ✅ Requiere mínimo 7 días de datos

**Ejemplo:**
```bash
POST /api/v1/predictive-analytics/subscriptions/1/predictions?residentId=1
Authorization: Bearer {token}
```

**Respuestas:**
```json
# 201 Created - Predicción generada exitosamente
{
  "subscriptionId": 1,
  "residentId": 1,
  "predictionDate": "2025-11-06T14:00:00",
  "currentWaterLevel": 680.0,
  "daysUntilRunout": 7,
  ...
}

# 400 Bad Request - Datos insuficientes (< 7 días)
# 403 Forbidden - Suscripción no pertenece al residente
# 500 Internal Server Error
```

---

### **3. Obtener historial de consumo**
```http
GET /api/v1/predictive-analytics/subscriptions/{subscriptionId}/consumption-history?startDate=2025-10-01&endDate=2025-10-31
```

**Descripción:**
- ✅ Solo lectura
- ✅ Fechas opcionales (por defecto: últimos 30 días)

**Parámetros Query:**
- `startDate` (opcional): Fecha inicio en formato `yyyy-MM-dd`
- `endDate` (opcional): Fecha fin en formato `yyyy-MM-dd`

**Ejemplo:**
```bash
GET /api/v1/predictive-analytics/subscriptions/1/consumption-history?startDate=2025-10-25&endDate=2025-10-31
Authorization: Bearer {token}
```

**Respuesta:**
```json
# 200 OK
[
  {
    "date": "2025-10-25",
    "consumption": 60.0,
    "initialLevel": 1000.0,
    "finalLevel": 940.0,
    "waterQuality": "excellent",
    "isRefill": false,
    "deviceId": 1
  },
  {
    "date": "2025-10-26",
    "consumption": 60.0,
    "initialLevel": 940.0,
    "finalLevel": 880.0,
    "waterQuality": "good",
    "isRefill": false,
    "deviceId": 1
  }
]

# 200 OK con lista vacía [] - No hay datos en el rango
```

---

### **4. 🆕 Obtener todas las predicciones de un residente**
```http
GET /api/v1/predictive-analytics/residents/{residentId}/predictions
```

**Descripción:**
- ✅ Retorna predicciones de TODAS las suscripciones activas del residente
- ✅ Útil para dashboard con múltiples tanques
- ✅ Solo lectura (no genera predicciones)

**Ejemplo:**
```bash
GET /api/v1/predictive-analytics/residents/1/predictions
Authorization: Bearer {token}
```

**Respuesta:**
```json
# 200 OK
[
  {
    "subscriptionId": 1,
    "residentId": 1,
    "currentWaterLevel": 720.5,
    "daysUntilRunout": 8,
    "waterRunoutDate": "2025-11-14",
    "status": "ACTIVE"
  },
  {
    "subscriptionId": 2,
    "residentId": 1,
    "currentWaterLevel": 450.0,
    "daysUntilRunout": 5,
    "waterRunoutDate": "2025-11-11",
    "status": "ACTIVE"
  }
]

# 200 OK con lista vacía [] - No hay suscripciones activas
```

---

## 📋 **Resumen de Cambios**

| Antes (residentId en ruta) | Ahora (subscriptionId en ruta) |
|-----------------------------|---------------------------------|
| `/residents/{id}/predictions` | `/subscriptions/{id}/predictions?residentId={id}` |
| GET generaba predicción si no existía ❌ | GET solo lee, POST genera ✅ |
| No soportaba múltiples tanques ❌ | Cada suscripción tiene su predicción ✅ |
| - | 🆕 `/residents/{id}/predictions` (todas las suscripciones) |

---

## 🎯 **Flujo de Uso Típico**

### **Escenario 1: Dashboard Principal**
```bash
# 1. Usuario entra al dashboard
GET /api/v1/predictive-analytics/residents/1/predictions
→ Ve todas sus suscripciones (tanques de agua)

# Respuesta: Lista con múltiples tanques
[
  { subscriptionId: 1, currentWaterLevel: 720L, daysUntilRunout: 8 },
  { subscriptionId: 2, currentWaterLevel: 450L, daysUntilRunout: 5 }
]
```

### **Escenario 2: Ver Detalles de un Tanque**
```bash
# 2. Usuario hace clic en un tanque específico
GET /api/v1/predictive-analytics/subscriptions/1/predictions?residentId=1
→ Ve predicción completa del tanque seleccionado

# Si hay predicción → muestra gráfico y detalles
# Si 404 → muestra botón "Generar Primera Predicción"
```

### **Escenario 3: Actualizar Predicción**
```bash
# 3. Usuario hace clic en "Actualizar Predicción"
POST /api/v1/predictive-analytics/subscriptions/1/predictions?residentId=1
→ Genera nueva predicción (marca la anterior como OUTDATED)

# Respuesta 201: Nueva predicción generada
# Frontend actualiza la vista automáticamente
```

### **Escenario 4: Ver Historial**
```bash
# 4. Usuario navega a "Historial de Consumo"
GET /api/v1/predictive-analytics/subscriptions/1/consumption-history
→ Ve gráfico de consumo histórico (últimos 30 días)

# Frontend puede especificar rango:
GET /api/v1/predictive-analytics/subscriptions/1/consumption-history?startDate=2025-10-01&endDate=2025-10-31
```

---

## ⚠️ **Importante para Frontend**

### **Cambios Obligatorios:**

1. **subscriptionId es OBLIGATORIO** en la ruta (antes era residentId)
   ```javascript
   // ❌ Antes:
   GET /residents/${residentId}/predictions
   
   // ✅ Ahora:
   GET /subscriptions/${subscriptionId}/predictions?residentId=${residentId}
   ```

2. **residentId es OBLIGATORIO** como query param (para validación de seguridad)
   ```javascript
   // Siempre incluir residentId en query params
   const url = `/subscriptions/${subscriptionId}/predictions?residentId=${residentId}`;
   ```

3. **GET ya NO genera predicciones** (antes lo hacía)
   ```javascript
   // ❌ Antes: GET podía generar predicción nueva
   // ✅ Ahora: Solo GET para leer, POST para crear
   
   // Leer predicción existente:
   GET /subscriptions/1/predictions?residentId=1
   
   // Generar nueva predicción:
   POST /subscriptions/1/predictions?residentId=1
   ```

4. **Cada tanque = 1 suscripción = predicciones independientes**
   ```javascript
   // Usuario con 2 tanques:
   // - subscriptionId: 1 → Tanque A (12L)
   // - subscriptionId: 2 → Tanque B (30L)
   
   // Cada uno tiene su propia predicción
   ```

---

## 🔐 **Autenticación**

Todos los endpoints requieren autenticación con JWT:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📊 **Códigos de Estado HTTP**

| Código | Significado | Cuándo Ocurre |
|--------|-------------|---------------|
| 200 OK | Éxito | GET encontró datos |
| 201 Created | Creado | POST generó predicción exitosamente |
| 400 Bad Request | Datos insuficientes | Menos de 7 días de datos para predicción |
| 403 Forbidden | Acceso denegado | Suscripción no pertenece al residente |
| 404 Not Found | No encontrado | No existe predicción activa para esa suscripción |
| 500 Internal Server Error | Error del servidor | Error inesperado en el backend |

---

## 💡 **Tips de Implementación Frontend**

### **1. Manejo de múltiples tanques:**
```javascript
// Obtener todas las predicciones del usuario
const predictions = await fetch(
  `/api/v1/predictive-analytics/residents/${userId}/predictions`
);

// Mostrar tarjetas para cada tanque
predictions.forEach(pred => {
  renderTankCard({
    subscriptionId: pred.subscriptionId,
    waterLevel: pred.currentWaterLevel,
    daysLeft: pred.daysUntilRunout
  });
});
```

### **2. Verificar si existe predicción:**
```javascript
async function loadPrediction(subscriptionId, residentId) {
  try {
    const response = await fetch(
      `/api/v1/predictive-analytics/subscriptions/${subscriptionId}/predictions?residentId=${residentId}`
    );
    
    if (response.status === 404) {
      // No hay predicción → mostrar botón "Generar"
      showGenerateButton();
    } else if (response.ok) {
      // Hay predicción → mostrar datos
      const prediction = await response.json();
      renderPrediction(prediction);
    }
  } catch (error) {
    showError(error);
  }
}
```

### **3. Generar nueva predicción:**
```javascript
async function generatePrediction(subscriptionId, residentId) {
  try {
    const response = await fetch(
      `/api/v1/predictive-analytics/subscriptions/${subscriptionId}/predictions?residentId=${residentId}`,
      { method: 'POST' }
    );
    
    if (response.status === 400) {
      showError('Se necesitan al menos 7 días de datos');
    } else if (response.ok) {
      const newPrediction = await response.json();
      renderPrediction(newPrediction);
      showSuccess('Predicción generada exitosamente');
    }
  } catch (error) {
    showError(error);
  }
}
```

---

**Versión:** 2.0  
**Fecha:** 2025-11-06  
**Estado:** ✅ Documentación actualizada con soporte multi-subscription
