# Plan de desarrollo para corregir vulnerabilidades (Security Remediation Plan)

Este plan convierte los hallazgos del `SECURITY_AUDIT.md` en un roadmap ejecutable con prioridades, entregables, validaciones y criterios de aceptación.

## Objetivos

1. Reducir riesgo **crítico/alto** en 2–3 sprints.
2. Endurecer autenticación, autorización, CORS, WebSocket y endpoints operativos.
3. Mejorar controles preventivos (validación, headers, rate limit, hardening de uploads).
4. Dejar seguridad integrada al ciclo de desarrollo (tests + gates en CI).

---

## Enfoque por fases (prioridad)

- **Fase 0 (rápida, 2–3 días):** Contención inmediata de riesgo alto.
- **Fase 1 (1 sprint):** Refactor de tokens/sesiones + controles de acceso.
- **Fase 2 (1 sprint):** Hardening de entrada/salida y superficie operativa.
- **Fase 3 (continuo):** Seguridad de dependencias, observabilidad y compliance interno.

---

## Matriz de remediación (hallazgo → acción)

## 1) Broken Access Control (listado de usuarios)
**Riesgo:** Alto  
**Acciones:**
- Introducir `role` en modelo `User` (`user`, `admin`).
- Crear middleware `requireRole(...roles)`.
- Proteger `/api/auth/users` con `auth + requireRole('admin')`.
- Revisar endpoints similares para evitar enumeración de datos.

**Entregables técnicos:**
- `server/models/User.js` (campo role + índice opcional)
- `server/middleware/requireRole.js`
- `server/routes/auth.js` (protección de ruta)
- Migración/backfill de usuarios existentes a `role: user`

**Criterios de aceptación:**
- Usuario no-admin recibe `403` al consultar `/api/auth/users`.
- Admin recibe `200` y payload permitido.

**Pruebas mínimas:**
- Test API: token user normal → 403.
- Test API: token admin → 200.

---

## 2) Falta de rate limiting en autenticación/endpoints costosos
**Riesgo:** Alto  
**Acciones:**
- Añadir `express-rate-limit` por grupos:
  - Auth (`/login`, `/register`, `/refresh`).
  - Endpoints costosos (`/ohlc/*/sync*`, `/exchange/prices`, `/predictions/*`).
- Añadir protección por IP + fallback por `userId` cuando aplique.
- Estándar de respuesta `429` con retry headers.

**Entregables técnicos:**
- `server/middleware/rateLimiters.js`
- Wiring en `server/index.js` y rutas específicas.

**Criterios de aceptación:**
- Más de N requests en ventana retorna `429`.
- No afecta uso normal (smoke test funcional).

---

## 3) Refresh token en texto plano + replay
**Riesgo:** Alto  
**Acciones:**
- Guardar **hash** de refresh token (SHA-256) en BD, nunca token plano.
- Rotación de refresh token en cada uso (`refresh token rotation`).
- Invalidación de token anterior al refrescar.
- Guardar metadatos de sesión (UA/IP/fecha) para trazabilidad.

**Entregables técnicos:**
- `server/models/RefreshToken.js` (tokenHash + métodos de validación/rotación)
- `server/controllers/authController.js` (nuevo flujo refresh)
- Índices para búsqueda eficiente por hash y expiración.

**Criterios de aceptación:**
- Un refresh token usado previamente no puede reutilizarse.
- Dump de BD no expone tokens reutilizables.

---

## 4) Tokens en localStorage (impacto XSS)
**Riesgo:** Alto  
**Acciones:**
- Mover refresh token a cookie `HttpOnly + Secure + SameSite=Strict`.
- Mantener access token en memoria (o cookie corta si se decide BFF-like).
- Ajustar frontend para no persistir tokens sensibles en `localStorage`.
- Endpoint `/auth/refresh` debe leer cookie y emitir nueva sesión.

**Entregables técnicos:**
- `src/stores/auth.js` (eliminar persistencia de tokens en localStorage)
- `server/controllers/authController.js` (set/clear cookie)
- `server/index.js` (si aplica `cookie-parser` y config secure)

**Criterios de aceptación:**
- `localStorage` no contiene access/refresh token.
- Login/refresh/logout funcionan con cookies seguras.

---

## 5) CORS permisivo con credentials
**Riesgo:** Medio  
**Acciones:**
- Reemplazar regex amplia por allowlist explícita de orígenes.
- Soportar múltiples orígenes mediante variable de entorno CSV.
- Denegar origen no listado.

**Entregables técnicos:**
- `server/index.js` (función `origin` con allowlist)
- `.env.example` documentado (`CORS_ALLOWED_ORIGINS=`)

**Criterios de aceptación:**
- Origen permitido: OK.
- Origen no permitido: bloqueado por CORS.

---

## 6) Falta de security headers
**Riesgo:** Medio  
**Acciones:**
- Integrar `helmet` con CSP base.
- Activar `X-Content-Type-Options`, `frameguard`, `referrer-policy`.
- HSTS solo en producción HTTPS.

**Entregables técnicos:**
- `server/index.js` (helmet config)
- Documento de excepciones CSP para frontend/APIs externas.

**Criterios de aceptación:**
- Headers visibles en respuestas API (verificados por curl/integration tests).

---

## 7) WebSocket hijacking / auth débil
**Riesgo:** Medio  
**Acciones:**
- Rechazar conexión socket sin token válido para canales privados.
- Eliminar token vía query string; usar solo `handshake.auth`.
- Rate limit de eventos de suscripción por socket.
- Validar formato y cantidad de `coinIds` suscritos.

**Entregables técnicos:**
- `server/socket/index.js` (handshake estricto + validaciones)
- `src/services/socket.js` (ajuste de envío de auth token)

**Criterios de aceptación:**
- Con token inválido: handshake rechazado.
- No se aceptan tokens por query param.

---

## 8) Endpoints operativos públicos (`/exchange/cache`, `/ohlc/sync`)
**Riesgo:** Alto  
**Acciones:**
- Requerir autenticación + rol admin para operaciones de mantenimiento.
- Añadir auditoría (quién ejecutó, cuándo, resultado).

**Entregables técnicos:**
- `server/routes/exchange.js`, `server/routes/ohlc.js`
- Middleware de autorización reutilizable
- Logging estructurado en acciones administrativas

**Criterios de aceptación:**
- Usuario no autenticado/no admin no puede ejecutar sync/clear cache.

---

## 9) Hardening de validación/entrada (settings/socialLinks)
**Riesgo:** Medio  
**Acciones:**
- Aplicar allowlist explícita de campos actualizables.
- Rechazar payloads con claves inesperadas o profundas.
- Añadir saneamiento de filtros Mongoose (`sanitizeFilter`) y validaciones estrictas.

**Entregables técnicos:**
- `server/controllers/authController.js` (sanitización de payload)
- Validadores adicionales con `express-validator`/schemas.

**Criterios de aceptación:**
- Campos no permitidos generan `400`.
- No se persisten claves fuera de contrato.

---

## 10) Upload hardening (MIME trust)
**Riesgo:** Medio  
**Acciones:**
- Validar tipo real por magic bytes (`file-type`).
- Renombrar/normalizar extensión según tipo detectado.
- Servir uploads con headers estrictos (`nosniff`) y política de contenido.

**Entregables técnicos:**
- `server/middleware/upload.js`
- `server/index.js` (headers en static de uploads)

**Criterios de aceptación:**
- Archivos no-imagen reales son rechazados aunque falseen MIME.

---

## Plan de sprints sugerido

## Sprint 1 (riesgo alto inmediato)
1. RBAC + protección `/auth/users`.
2. Rate limiting en auth y endpoints costosos.
3. Blindaje de endpoints operativos admin-only.
4. CORS allowlist estricta.

**Meta de salida:** eliminar exposición y abuso más críticos.

## Sprint 2 (sesiones y transporte seguro)
1. Hash de refresh tokens + rotación anti-replay.
2. Migración a cookie HttpOnly para refresh.
3. Eliminar tokens de localStorage.
4. Hardening WebSocket auth.

**Meta de salida:** reducir drásticamente ATO/replay/hijacking.

## Sprint 3 (hardening profundo)
1. Helmet + CSP y headers finales.
2. Validación estricta de payloads y filtros.
3. Upload hardening por magic bytes.
4. Tests de seguridad automatizados + checklist de release.

**Meta de salida:** baseline de seguridad estable y repetible.

---

## Estrategia de testing de seguridad

### Automatizado (obligatorio en CI)
- Unit tests de middlewares (`auth`, `requireRole`, rate limit).
- Integration/API tests:
  - 401/403/429 esperados según caso.
  - Refresh token rotation (token viejo inválido).
  - CORS bloquea origen no permitido.
- Socket tests:
  - handshake con token inválido rechazado.
  - límite de eventos de suscripción.

### Manual / pentest interno
- Pruebas OWASP ASVS-lite por endpoint crítico.
- Intentos de escalación horizontal/vertical.
- Simulación de replay de refresh token.
- Abuso de endpoints de sync/cache.

---

## Definición de Done (DoD) por vulnerabilidad

Una vulnerabilidad se considera cerrada solo si cumple:
1. Código implementado y revisado.
2. Test automático que reproduce/fija el caso.
3. Evidencia de validación manual.
4. Documentación de operación actualizada.
5. Sin regresiones en smoke test funcional.

---

## Métricas de seguimiento

- % de hallazgos críticos/altos cerrados.
- Tiempo medio de remediación por severidad.
- Ratio de endpoints con authz explícita.
- Cobertura de tests de seguridad en rutas críticas.
- Número de bloqueos 429 y 403 (telemetría útil).

---

## Riesgos de implementación y mitigación

- **Riesgo:** romper sesión actual al migrar tokens.  
  **Mitigación:** rollout con feature flag + ventana de compatibilidad temporal.

- **Riesgo:** CSP rompe recursos externos.  
  **Mitigación:** desplegar CSP en modo report-only primero.

- **Riesgo:** rate limit impacta usuarios legítimos.  
  **Mitigación:** thresholds por endpoint + observación inicial y tuning.

---

## Checklist ejecutivo (orden recomendado)

- [ ] Bloquear `/api/auth/users` a admin.
- [ ] Añadir rate limit en auth y endpoints de alto costo.
- [ ] Proteger endpoints operativos con authz admin.
- [ ] CORS allowlist estricta.
- [ ] Refresh token hashing + rotación.
- [ ] Refresh en cookie HttpOnly y retiro de localStorage.
- [ ] Endurecer handshake Socket.io.
- [ ] Integrar `helmet` + headers.
- [ ] Validación estricta de payloads de perfil/settings.
- [ ] Validación de archivos por magic bytes + `nosniff`.
- [ ] Tests de seguridad en CI y evidencia de cierre.

