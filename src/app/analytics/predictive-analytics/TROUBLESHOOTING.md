# Troubleshooting Guide - Predictive Analytics

## Problemas Encontrados y Soluciones

### ❌ Error 1: `subscriptions/undefined` en las URLs

**Problema:**
```
GET http://localhost:8080/api/v1/predictive-analytics/subscriptions/undefined/consumption-history 401
GET http://localhost:8080/api/v1/predictive-analytics/subscriptions/undefined/predictions/history?residentId=1 401
```

**Causa Raíz:**
El backend **NO está devolviendo el campo `subscriptionId`** en las respuestas JSON. Tu respuesta actual es:

```json
{
  "residentId": 1,
  "predictionDate": "2025-11-06T19:46:04.114512",
  "dailyAverageConsumption": 0.75,
  // ❌ FALTA: "subscriptionId": 5
}
```

**Solución Implementada en Frontend:**
1. ✅ Hice `subscriptionId` opcional en los interfaces TypeScript
2. ✅ Agregué validación antes de llamar a servicios que requieren `subscriptionId`
3. ✅ Agregué mensajes de advertencia en la UI cuando falta `subscriptionId`
4. ✅ Oculté botones que dependen de `subscriptionId` cuando no está disponible

**Solución RECOMENDADA en Backend:**
Actualizar tu endpoint para incluir `subscriptionId` en cada respuesta:

```java
// En tu DTO de respuesta
@Getter
@Setter
public class PredictionResponse {
    private Long subscriptionId;  // ✅ AGREGAR ESTE CAMPO
    private Long residentId;
    private LocalDateTime predictionDate;
    // ... otros campos
}
```

### ❌ Error 2: 401 Unauthorized

**Problema:**
```
GET .../subscriptions/undefined/consumption-history 401 (Unauthorized)
GET .../subscriptions/undefined/predictions/history?residentId=1 401 (Unauthorized)
```

**Causas Posibles:**

1. **Token no existe en localStorage**
   - Verifica en DevTools → Application → Local Storage → `auth_token`
   - Si no existe, necesitas iniciar sesión

2. **Token expiró**
   - Los JWTs tienen tiempo de expiración
   - Necesitas renovar el token o volver a iniciar sesión

3. **Endpoints no están configurados en el backend**
   - Los endpoints pueden no existir aún
   - Verifica que tu backend tenga estos endpoints implementados:
     - `GET /api/v1/predictive-analytics/subscriptions/{id}/consumption-history`
     - `GET /api/v1/predictive-analytics/subscriptions/{id}/predictions/history`

4. **CORS o configuración de seguridad**
   - El backend puede estar rechazando el token para estos endpoints específicos

**Solución Implementada en Frontend:**
1. ✅ Agregué verificación de token en `ngOnInit()`
2. ✅ Agregué mejor manejo de errores 401 y 404
3. ✅ Agregué logs para debugging
4. ✅ El sistema continúa funcionando sin estos endpoints (graceful degradation)

**Verificaciones en Backend:**

```java
// 1. Verifica que los endpoints existen
@GetMapping("/subscriptions/{subscriptionId}/consumption-history")
public ResponseEntity<List<ConsumptionRecord>> getConsumptionHistory(
    @PathVariable Long subscriptionId
) {
    // implementación
}

@GetMapping("/subscriptions/{subscriptionId}/predictions/history")
public ResponseEntity<List<PredictionResponse>> getPredictionHistory(
    @PathVariable Long subscriptionId,
    @RequestParam Long residentId
) {
    // implementación
}

// 2. Verifica configuración de seguridad
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    // Asegúrate que estos endpoints permitan tokens Bearer
    .requestMatchers("/api/v1/predictive-analytics/**").authenticated()
}
```

### ❌ Error 3: "Failed to generate prediction" al cambiar de suscripción

**Problema:**
Al cambiar de una suscripción a otra aparece el mensaje:
```
⚠️ Failed to generate prediction. Ensure subscription has at least 7 days of data.
```

**Causa:**
Este mensaje aparece cuando intentas **regenerar una predicción** y hay un error. Puede ser por:

1. **La suscripción realmente no tiene 7 días de datos**
   - El backend requiere mínimo 7 días de datos históricos
   
2. **El subscriptionId es undefined**
   - Si el backend no devuelve `subscriptionId`, no se puede generar predicción
   
3. **Error 401 al intentar generar**
   - Problema de autenticación

**Solución:**
1. ✅ El botón "Regenerate" ahora solo se muestra si `subscriptionId` existe
2. ✅ Mejor manejo de errores en `generatePredictionForSubscription()`
3. Verifica que tu backend incluya `subscriptionId` en las respuestas
4. Asegúrate que cada suscripción tenga al menos 7 días de datos de consumo

## Checklist de Verificación Backend

### 🔧 Configuración Requerida

- [ ] **Incluir `subscriptionId` en todas las respuestas de predicción**
  ```json
  {
    "subscriptionId": 5,  // ✅ REQUERIDO
    "residentId": 1,
    "predictionDate": "...",
    "status": "ACTIVE",
    // ... otros campos
  }
  ```

- [ ] **Implementar endpoint de historial de consumo**
  ```
  GET /api/v1/predictive-analytics/subscriptions/{subscriptionId}/consumption-history
  ```

- [ ] **Implementar endpoint de historial de predicciones**
  ```
  GET /api/v1/predictive-analytics/subscriptions/{subscriptionId}/predictions/history?residentId={residentId}
  ```

- [ ] **Configurar autenticación JWT para estos endpoints**
  - Permitir Bearer tokens
  - Verificar que el token no haya expirado
  - Validar permisos del usuario

- [ ] **Incluir campo `status` en todas las predicciones**
  ```json
  {
    "status": "ACTIVE" | "OUTDATED"
  }
  ```

- [ ] **Endpoint para obtener todas las predicciones de un residente**
  ```
  GET /api/v1/predictive-analytics/residents/{residentId}/predictions
  ```
  Debe devolver un array con todas las suscripciones del residente, cada una con su predicción.

### 🧪 Pruebas en Backend

```bash
# 1. Verificar token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/v1/predictive-analytics/residents/1/predictions

# 2. Verificar historial de predicciones
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/v1/predictive-analytics/subscriptions/5/predictions/history?residentId=1

# 3. Verificar historial de consumo
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/v1/predictive-analytics/subscriptions/5/consumption-history
```

## Debugging en Frontend

### Ver Token en Console

Abre DevTools (F12) y ejecuta:
```javascript
// Ver token
console.log('Token:', localStorage.getItem('auth_token'));

// Decodificar JWT (solo para debug, no en producción)
const token = localStorage.getItem('auth_token');
if (token) {
  const parts = token.split('.');
  const payload = JSON.parse(atob(parts[1]));
  console.log('Token payload:', payload);
  console.log('Token expira:', new Date(payload.exp * 1000));
}
```

### Ver Requests en Network Tab

1. Abre DevTools → Network
2. Filtra por "predictive"
3. Selecciona un request fallido
4. Ve a "Headers" → "Request Headers"
5. Verifica que `Authorization: Bearer ...` esté presente

### Logs Útiles

El componente ahora incluye logs detallados:
- ✅ Advertencia si no hay token al iniciar
- ✅ Log cuando carga historial de predicciones
- ✅ Log cuando carga historial de consumo
- ✅ Warnings específicos para errores 401 y 404

## Resumen de Cambios Frontend

### Archivos Modificados

1. **`prediction.model.ts`**
   - `subscriptionId` ahora es opcional: `subscriptionId?: number`

2. **`predictive-analytics.component.ts`**
   - Verificación de token en `ngOnInit()`
   - Validación de `subscriptionId` antes de llamar servicios
   - Mejor manejo de errores 401 y 404
   - Logs mejorados para debugging

3. **`predictive-analytics.component.html`**
   - Botones "Regenerate" solo se muestran si hay `subscriptionId`
   - Mensaje de advertencia si falta `subscriptionId`
   - Títulos adaptados para funcionar sin `subscriptionId`
   - Sección de historial solo se muestra si hay `subscriptionId`

### Comportamiento Actual

✅ **Funciona sin `subscriptionId`:**
- Muestra predicciones básicas
- Muestra gráficos
- Muestra métricas principales

❌ **No funciona sin `subscriptionId`:**
- Regenerar predicciones
- Ver historial de consumo
- Ver historial de predicciones
- Identificar suscripciones específicas

## Próximos Pasos

1. **Actualizar Backend** (PRIORITARIO)
   - Incluir `subscriptionId` en todas las respuestas
   - Implementar endpoints de historial si no existen
   - Verificar configuración de autenticación JWT

2. **Verificar Datos**
   - Asegurarse que cada suscripción tenga ≥7 días de datos
   - Verificar que el campo `status` se actualice correctamente

3. **Probar Flujo Completo**
   - Login → Seleccionar residente → Ver suscripciones
   - Generar predicción → Ver historial
   - Cambiar entre suscripciones

4. **Monitoring**
   - Revisar logs del backend para errores 401
   - Verificar tiempo de expiración de tokens JWT
   - Monitorear performance de queries de historial
