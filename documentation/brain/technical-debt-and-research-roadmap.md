# Deuda técnica e investigaciones pendientes — Crypto Market Anomaly Detector

> Auditoría actualizada: 2026-05-29  
> Proyecto: `C:\Projects\CryptoProject`  
> Alcance: frontend Vue/Pinia, backend Express/Socket.io, trading agent, algoritmos, datos, seguridad, DevOps, documentación.  
> Restricción aplicada: no se ejecutó `npm run build`.

---

## 1. Resumen ejecutivo

El proyecto tiene una visión potente: plataforma de análisis y trading cripto con datos multi-exchange vía CCXT, indicadores técnicos, Fibonacci, Kalman, predicciones, agente de trading autónomo, dashboard en tiempo real y persistencia MongoDB. La base funcional existe, pero el estado actual NO está listo para crecer con seguridad hacia trading real, escalabilidad o algoritmos avanzados sin antes pagar deuda técnica crítica.

La deuda principal no es “falta de features”. Es más seria: la casa ya tiene varios pisos, pero todavía faltan planos estructurales, pruebas de carga, normas eléctricas y sensores de incendio. En software eso significa: testing, observabilidad, contratos de datos, validación, separación de dominios, calibración algorítmica y pipeline de calidad.

Hallazgos verificados:

- `npm run lint` falla con **1111 errores y 681 warnings**.
- `npm test` falla antes de ejecutar tests porque Vitest/Vite no puede cargar la configuración: `spawn EPERM` desde Vite/Rolldown.
- Hay solo **5 archivos de test**, todos concentrados en `test/agent`.
- El README/documentación previa presenta **mojibake** y contradicciones de licencia: README menciona MIT, pero `package.json`, `server/package.json` y `LICENSE` apuntan a AGPL-3.0.
- El documento anterior `documentation/brain/technical-debt-and-research-roadmap.md` estaba fechado `2026-05-22` y también tenía codificación corrupta.
- CI existe en `.github/workflows/ci.yml`, pero actualmente queda bloqueado por lint/test y además ejecuta build, lo cual debe tratarse con cuidado frente a la regla local de “no construir después de cambios”.
- El backend usa CommonJS bajo `server/`, mientras el root declara `"type": "module"`; funciona por `server/package.json`, pero ESLint desde root no está configurado por ambiente/capa.

---

## 2. Estado actual del proyecto

### 2.1 Stack observado

| Capa | Tecnología | Estado |
|---|---|---|
| Frontend | Vue 3, Pinia, Vite, Tailwind, lightweight-charts | Funcional, pero con deuda de tipado, servicios duplicados, errores globales y bundle/performance pendiente |
| Backend | Express 5, Socket.io, Mongoose, CCXT | Funcional, pero monolítico, mezcla capas y carece de observabilidad fuerte |
| Datos | MongoDB/Mongoose | Correcto para usuarios/transacciones; discutible para OHLCV/time-series a largo plazo |
| Trading | CCXT, agent FSM, kill switch, scoring, execution | Ambicioso, pero necesita backtesting, paper trading y validación antes de dinero real |
| Algoritmos | Kalman, Transformer JS naive, Fibonacci, TA indicators | Implementados, pero falta calibración, validación científica y benchmarking |
| Calidad | ESLint, Vitest, GitHub Actions | Existe infraestructura, pero no está verde |
| Infra | Dockerfile, docker-compose, healthcheck básico | Útil para contenedores, falta hardening y health checks profundos |

### 2.2 Tamaño aproximado verificado

| Métrica | Valor observado |
|---|---:|
| Vistas Vue | 23 |
| Stores Pinia | 15 |
| Servicios frontend | 9 |
| Componentes bottrading | 7 |
| Rutas backend | 14 |
| Controladores backend | 10 |
| Servicios backend | 12 |
| Modelos Mongoose base | 8 |
| Módulos `server/talib` | 17+ submódulos |
| Módulos `server/trading` | agent, backtesting, context, indicators, levels, mtf, patterns, priceAction, signals |
| Tests | 5 archivos |

---

## 3. Riesgos bloqueantes

### B-001 — La calidad automática está rota

**Evidencia:** `npm run lint` falla con 1111 errores y 681 warnings.

**Causa principal:** ESLint no distingue ambientes Node/browser/test. Por eso marca `require`, `module`, `process`, `console`, `window`, `document`, `fetch`, `localStorage`, `setInterval`, etc. como no definidos. También revela problemas reales: variables no usadas, `vue/valid-v-memo`, asignaciones inútiles y exceso de `console`.

**Impacto:** CI no puede proteger el proyecto. Si el lint falla siempre, el equipo aprende a ignorarlo. ESO ES GRAVE: una alarma que siempre suena deja de ser alarma.

**Acción recomendada:**

1. Separar configuración ESLint por contexto:
   - `server/**/*.js` con globals Node/CommonJS.
   - `src/**/*.js` y `src/**/*.vue` con globals browser.
   - `test/**/*.js` con globals Vitest/Node.
2. Mantener `no-console` como warning inicialmente, luego subir a error con logger formal.
3. Limpiar warnings reales gradualmente por módulo.

---

### B-002 — Los tests no ejecutan

**Evidencia:** `npm test` falla al cargar `vite.config.js` con `spawn EPERM` desde Vite/Rolldown.

**Impacto:** no hay garantía de regresión. Peor aún: no se sabe si los 5 tests existentes siguen válidos.

**Investigación necesaria:**

- Confirmar si el fallo viene de sandbox/permisos Windows, Node 24, Vite 8/Rolldown o configuración Vitest.
- Verificar matriz soportada Node/Vite/Vitest. El proyecto declara Node `>=18`, pero la ejecución local reportó Node `v24.14.1`.
- Evaluar fijar Node LTS en `.nvmrc`/`.node-version` y CI.

**Acción recomendada:** estabilizar test runner antes de agregar features.

---

### B-003 — Cobertura de pruebas insuficiente

**Evidencia:** solo existen tests en:

- `test/agent/killSwitch.test.js`
- `test/agent/phases/research.test.js`
- `test/agent/phases/scoring.test.js`
- `test/agent/structures/messageQueue.test.js`
- `test/agent/structures/ringBuffer.test.js`

**Faltan tests para:**

- Auth: login/register/refresh/logout.
- Ownership/autorización en portfolio, transactions, watchlist.
- CCXT service con mocks.
- Prediction/Kalman/Fibonacci.
- Stores Pinia.
- Componentes críticos de trading/predicciones.
- Socket.io auth y rooms.
- API keys.

**Riesgo:** cualquier refactor serio es una cirugía sin anestesia ni monitor cardíaco.

---

### B-004 — Trading real no debe activarse sin validación profunda

**Evidencia:** existe agente autónomo, ejecución CCXT, kill switch y endpoints `/api/agent/*`.

**Problema:** sin backtesting integrado, paper trading robusto, slippage/fees, auditoría de órdenes y monitoreo fuerte, el sistema no debe tocar dinero real.

**Acción:** declarar explícitamente estados operativos:

- `research-only`
- `paper-trading`
- `sandbox-exchange`
- `live-readonly`
- `live-trading`

Y bloquear `live-trading` hasta cumplir gates de seguridad.

---

## 4. Inventario de deuda técnica

### 4.1 Arquitectura

| ID | Deuda | Evidencia | Severidad | Acción |
|---|---|---|---|---|
| ARQ-001 | Monolito con dominios mezclados | `server/index.js` concentra API, Socket.io, price service y agent routes | Alta | Separar bounded contexts: user/account, market-data, analysis, trading-agent |
| ARQ-002 | Patrón de capas inconsistente | Algunas rutas usan controller/service, otras lógica inline: `routes/exchange.js`, `routes/predictions.js`, `routes/agent.js` | Media | Convención única `route -> controller -> service -> model` |
| ARQ-003 | Agent de trading comparte proceso con API | `server/index.js` monta `/api/agent` y servicios generales | Alta | Mover agent a worker/process separado con cola/event bus |
| ARQ-004 | Duplicación de clientes HTTP frontend | `api.js` existe, pero varias vistas aún usan `fetch` directo | Media | Centralizar todo en `createApiClient` o adapters especializados |
| ARQ-005 | CommonJS/ESM mixto sin estrategia explícita | root `type: module`, backend CommonJS protegido por `server/package.json` | Media | Documentar frontera o migrar progresivamente |
| ARQ-006 | Falta contrato formal de API | README describe endpoints, pero no hay OpenAPI/JSON schema | Alta | Generar OpenAPI y usarlo como contrato |

### 4.2 Calidad, lint y testing

| ID | Deuda | Evidencia | Severidad | Acción |
|---|---|---|---|---|
| QA-001 | Lint roto | 1111 errores / 681 warnings | Crítica | Corregir ESLint por ambientes |
| QA-002 | Test runner roto | `npm test` falla con `spawn EPERM` | Crítica | Investigar Node/Vite/Vitest/Rolldown |
| QA-003 | Cobertura mínima | 5 tests, todos en agent | Crítica | Roadmap de tests por dominio |
| QA-004 | CI no puede ser gate real | `.github/workflows/ci.yml` ejecuta lint/test/build, pero lint/test fallan | Alta | Hacer CI verde por etapas |
| QA-005 | Sin tests frontend | No hay tests de stores/componentes | Alta | Vitest + Vue Test Utils + Pinia testing |
| QA-006 | Sin tests API | No se observa Supertest | Alta | Integration tests Express con DB test/mocks |
| QA-007 | Sin e2e | No hay Playwright/Cypress formal | Media | Flujos: login, portfolio, trading, prediction, agent sandbox |

### 4.3 Seguridad

| ID | Deuda | Evidencia | Severidad | Acción |
|---|---|---|---|---|
| SEC-001 | Tokens en localStorage | `src/stores/auth.js` usa `useLocalStorage` para access/refresh tokens | Alta | Evaluar refresh token en cookie httpOnly + access token en memoria |
| SEC-002 | Socket permite guest | `server/socket/index.js` permite conexión sin token | Media | Separar canales públicos/privados y validar subscribe |
| SEC-003 | CSP no ajustado | `app.use(helmet())` default | Media | Definir CSP concreta para app, charts y APIs necesarias |
| SEC-004 | Error responses pueden exponer detalles | Algunas rutas devuelven `error.message` | Media | Error handler con tipos seguros y mapping por entorno |
| SEC-005 | API key verification vía exchange real | `/api/agent/verify-keys` llama `fetchBalance` | Alta | Rate limit fuerte, audit log, never log secrets, permisos mínimos |
| SEC-006 | Falta auditoría completa de ownership | Pendiente verificar recurso por `req.user` en todos los controllers | Alta | Tests de autorización horizontal |
| SEC-007 | Sin rotación de JWT secrets | `JWT_SECRET` único | Media | `kid` + múltiples secretos activos + plan de rotación |

### 4.4 Observabilidad y operación

| ID | Deuda | Evidencia | Severidad | Acción |
|---|---|---|---|---|
| OBS-001 | Logging no estructurado | Uso amplio de `console.log/error/warn` | Alta | Pino/Winston + request id + JSON logs |
| OBS-002 | Healthcheck superficial | `/api/health` solo responde server running | Alta | Incluir MongoDB, Socket, cache, exchange degraded status |
| OBS-003 | Sin métricas | No se observa Prometheus/OpenTelemetry | Alta | Métricas: latencia, errores, rate limits, agent cycles, PnL paper |
| OBS-004 | Sin trazabilidad de órdenes | Agent loguea eventos, pero falta audit trail formal | Crítica para live trading | Event store o colección audit-only |
| OBS-005 | Sin alertas operativas | No hay integración de alerts | Media | Alertas para DB down, exchange fail, kill switch, drawdown |

### 4.5 Rendimiento y escalabilidad

| ID | Deuda | Evidencia | Severidad | Acción |
|---|---|---|---|---|
| PERF-001 | Cache en memoria sin límite | `Map` en `ccxtService.js` y `ccxtPriceService.js` | Alta | LRU con max entries/TTL o Redis |
| PERF-002 | CCXT instances sin lifecycle claro | `exchangeInstances = new Map()` | Media | Pool con TTL, health, cleanup |
| PERF-003 | Cargas pesadas en proceso API | Transformer/Kalman/TA en Node API | Alta | Worker threads o servicio analysis separado |
| PERF-004 | Datos OHLCV en Mongo generalista | `Candle` en Mongo | Media futura | Investigar Mongo time-series vs TimescaleDB/ClickHouse |
| PERF-005 | Sin compresión HTTP explícita | No se observa `compression` | Baja-media | Añadir compression para OHLCV/respuestas grandes |
| PERF-006 | Polling/intervalos dispersos | Frontend y agent usan varios `setInterval` | Media | Scheduler central con cancellation/backoff |
| PERF-007 | Bundle posiblemente grande | Vistas grandes: `DocsContent.vue` 799 líneas, `TALibContent.vue` 696, `ProfileContent.vue` 712 | Media | Lazy loading, split chunks, componentes presentacionales |

### 4.6 Frontend Vue/Pinia

| ID | Deuda | Evidencia | Severidad | Acción |
|---|---|---|---|---|
| FE-001 | Proyecto JavaScript sin tipos fuertes | `.js` y `.vue`, sin TS | Alta para dominio financiero | Migración progresiva a TS/JSDoc + schemas |
| FE-002 | Stores grandes | `proTrading.js` 668 líneas, `botTrading.js` 433, `tradingview.js` 449 | Media | Separar composables/adapters/use-cases |
| FE-003 | Componentes/vistas demasiado grandes | varias vistas >500 líneas | Media | Container/presentational + atomic design |
| FE-004 | Manejo global de errores ausente | No se observa `app.config.errorHandler` | Alta | Error boundary/global handler + toast/store |
| FE-005 | Servicios inconsistentes | `fetch` directo en vistas y servicios | Media | API client único con auth/refresh/error mapping |
| FE-006 | Persistencia local sin política | localStorage para tokens/config/análisis | Alta | Clasificar datos: sensitive/session/cache/preferences |
| FE-007 | `v-memo` inválido | Lint reporta `LearnContent.vue` `vue/valid-v-memo` | Baja | Corregir directiva |

### 4.7 Backend/API

| ID | Deuda | Evidencia | Severidad | Acción |
|---|---|---|---|---|
| BE-001 | Error handling heterogéneo | cada route/controller maneja catch distinto | Alta | Middleware global + `next(error)` |
| BE-002 | Validación parcial | Algunas rutas tienen express-validator; otras no | Alta | Validar params/query/body en todos los endpoints |
| BE-003 | `routes/agent.js` controla mucho | inicializa orchestrator, valida status, ejecuta ciclos | Alta | Controller/service separado; proteger modos live |
| BE-004 | Rate limiting global insuficiente | Global limiter existe, pero rutas CCXT/agent necesitan límites específicos | Alta | Rate limits por usuario, IP, exchange y operación |
| BE-005 | Sin paginación uniforme | endpoints de markets/positions/transactions requieren revisión | Media | Paginación/cursor en endpoints listados |
| BE-006 | Uploads servidos estáticos | `/uploads` desde public | Media | Validar acceso, antivirus opcional, storage separado |

### 4.8 Datos y persistencia

| ID | Deuda | Evidencia | Severidad | Acción |
|---|---|---|---|---|
| DATA-001 | Sin migraciones | No se observa carpeta migrations | Alta | `migrate-mongo` o scripts versionados |
| DATA-002 | Time-series sin estrategia de retención | OHLCV y signals pueden crecer sin límite | Alta | TTL/particiones/retención por timeframe |
| DATA-003 | Falta diccionario de datos vivo | README describe, pero no contrato verificable | Media | `documentation/architecture/database-schema.md` |
| DATA-004 | Índices deben auditarse | Modelos tienen algunos índices, pero falta matriz por query real | Alta | Explain plans por endpoint crítico |
| DATA-005 | Datos externos sin trazabilidad | CoinGecko/CCXT pueden devolver inconsistencias | Media | Guardar source, exchange, timeframe, fetchedAt, version |

### 4.9 Algoritmos y análisis avanzado

| ID | Deuda | Evidencia | Severidad | Acción |
|---|---|---|---|---|
| ALG-001 | Transformer no entrenado | `SimpleTransformer` inicializa pesos aleatorios | Crítica | No vender como ML predictivo confiable; reemplazar/validar |
| ALG-002 | Kalman con parámetros fijos | `processNoise=0.0001`, `measurementNoise=0.01` | Alta | Calibración por activo/timeframe/regime |
| ALG-003 | Confianza heurística | confidence basada en volatilidad/covarianza simplificada | Alta | Backtesting probabilístico y calibration curves |
| ALG-004 | Falta benchmark contra baseline | No se observa comparación con naive/random walk/EMA | Crítica | Baselines obligatorios antes de modelos avanzados |
| ALG-005 | TA indicators duplicados | frontend utils vs backend indicators/talib | Media | Shared package o fuente canónica |
| ALG-006 | Backtesting parcial | `server/trading/backtesting` existe, pero no está integrado al producto | Alta | Integrar UI/API/reportes |
| ALG-007 | Falta walk-forward riguroso | existe `talib/backtest/walkForward.js`, requiere integración y tests | Alta | Validación por ventanas, out-of-sample, fees/slippage |

### 4.10 Documentación y producto

| ID | Deuda | Evidencia | Severidad | Acción |
|---|---|---|---|---|
| DOC-001 | README con mojibake | caracteres corruptos visibles | Alta | Regenerar UTF-8 |
| DOC-002 | Licencia contradictoria | README dice MIT; package/LICENSE AGPL-3.0 | Alta | Corregir README |
| DOC-003 | Estado “completo” demasiado optimista | README lista módulos completos sin gates de calidad | Alta | Cambiar a estados: prototipo/funcional/testeado/producción |
| DOC-004 | Falta visión producto formal | No hay PRD/roadmap vivo | Alta | Documento de visión, alcance, no-alcance, métricas |
| DOC-005 | Falta threat model | Dominio financiero/trading lo requiere | Alta | STRIDE/LINDDUN básico |

---

## 5. Investigaciones necesarias para continuar la visión

### 5.1 Requerimientos y alcance

| ID | Investigación | Preguntas clave | Resultado esperado | Prioridad |
|---|---|---|---|---|
| INV-REQ-001 | Visión de producto y usuarios objetivo | ¿Es herramienta educativa, análisis, paper trading o trading real? | PRD con fases y límites | Crítica |
| INV-REQ-002 | Niveles de riesgo permitidos | ¿Qué puede ejecutar el bot? ¿solo sandbox? ¿live? | Matriz de permisos por modo | Crítica |
| INV-REQ-003 | Compliance/legal | ¿Qué disclaimers, jurisdicciones y restricciones aplican? | Documento legal/product risk | Alta |
| INV-REQ-004 | Métricas de éxito | ¿Precisión? ¿Sharpe? ¿drawdown? ¿latencia? ¿retención? | KPI tree | Alta |
| INV-REQ-005 | Roles y permisos | admin, trader, viewer, paper-only | RBAC/ABAC spec | Alta |
| INV-REQ-006 | Contratos API | REST/Socket/events/error schema | OpenAPI + event catalog | Alta |

### 5.2 Algoritmos avanzados

| ID | Investigación | Por qué importa | Alternativas | Prioridad |
|---|---|---|---|---|
| INV-ALG-001 | Baselines predictivos | Sin baseline no sabes si tu “ML” aporta | Random walk, naive last value, EMA, ARIMA | Crítica |
| INV-ALG-002 | Reemplazo de Transformer JS aleatorio | Pesos aleatorios no son modelo entrenado | Python service, ONNX Runtime, TensorFlow.js, statsmodels | Crítica |
| INV-ALG-003 | Calibración Kalman | Parámetros fijos fallan por activo/timeframe | EM, Bayesian optimization, adaptive Kalman | Alta |
| INV-ALG-004 | Regime detection | Cripto cambia entre tendencia/rango/volatilidad extrema | HMM, clustering, volatility regimes, ADX/ATR | Alta |
| INV-ALG-005 | Backtesting realista | Sin slippage/fees todo resultado engaña | Vectorized backtest, event-driven simulator | Crítica |
| INV-ALG-006 | Walk-forward validation | Evita overfitting | rolling windows, out-of-sample, purged CV | Alta |
| INV-ALG-007 | Risk engine | Trading se gana sobreviviendo, no prediciendo | Kelly capado, fixed fractional, volatility targeting | Alta |
| INV-ALG-008 | Explainability | Usuario necesita entender señales | feature contribution, signal breakdown | Media |

### 5.3 Rendimiento

| ID | Investigación | Decisión a tomar | Prioridad |
|---|---|---|---|
| INV-PERF-001 | Perfilado de endpoints pesados | ¿Qué consume CPU: TA, Kalman, CCXT, chart data? | Alta |
| INV-PERF-002 | Worker threads vs servicio separado | Sacar cálculos del proceso API | Alta |
| INV-PERF-003 | Cache LRU vs Redis | Single instance vs multi-instance | Alta |
| INV-PERF-004 | Compresión y payload OHLCV | Reducir latencia y transferencia | Media |
| INV-PERF-005 | Bundle analysis | Saber qué pesa en frontend | Media, pero no ejecutar build hasta permitirlo |
| INV-PERF-006 | WebSocket fanout | Cuántos usuarios/rooms soporta Socket.io actual | Alta futura |

### 5.4 Escalabilidad

| ID | Investigación | Alternativas | Prioridad |
|---|---|---|---|
| INV-SCALE-001 | Separación de servicios | modular monolith, workers, microservices | Alta |
| INV-SCALE-002 | Cola/event bus | BullMQ/Redis, RabbitMQ, NATS | Alta |
| INV-SCALE-003 | Time-series DB | Mongo time-series, TimescaleDB, ClickHouse, InfluxDB | Alta |
| INV-SCALE-004 | Multi-exchange rate limiting distribuido | Redis token bucket, Bottleneck cluster | Alta |
| INV-SCALE-005 | Horizontal scaling Socket.io | Redis adapter, sticky sessions | Media |
| INV-SCALE-006 | Data retention | cuánto guardar por timeframe/exchange | Alta |

### 5.5 Seguridad y operación

| ID | Investigación | Resultado esperado | Prioridad |
|---|---|---|---|
| INV-SEC-001 | Threat model trading app | Riesgos por auth, XSS, API keys, órdenes | Crítica |
| INV-SEC-002 | Token strategy | localStorage vs cookies httpOnly | Alta |
| INV-SEC-003 | Secret management | `.env` vs vault/secrets manager | Alta |
| INV-SEC-004 | Audit trail órdenes | No repudiation de decisiones del bot | Crítica |
| INV-SEC-005 | Observabilidad | logs, metrics, traces, alerts | Alta |

---

## 6. Roadmap recomendado

### Fase 0 — Congelar la expansión irresponsable

No agregar nuevas features de trading real hasta resolver gates mínimos. Esto no es burocracia; es ingeniería seria.

**Gates mínimos:**

- Lint ejecuta sin errores de configuración.
- Tests ejecutan local/CI.
- Auth y ownership testeados.
- Modo live trading bloqueado por feature flag.
- Documento de visión y riesgo aprobado.

### Fase 1 — Fundaciones de calidad

1. Corregir ESLint por ambientes.
2. Reparar Vitest/Vite en Windows/CI.
3. Agregar tests críticos:
   - auth refresh rotation,
   - portfolio ownership,
   - transaction ownership,
   - CCXT service con mocks,
   - kill switch y execution safeguards.
4. Corregir README/licencia/mojibake.
5. Error handler global + logger estructurado.

### Fase 2 — Contratos y seguridad

1. OpenAPI para REST.
2. Catálogo de eventos Socket.io.
3. Threat model.
4. Rate limiting por ruta crítica.
5. Estrategia de tokens y secrets.

### Fase 3 — Algoritmos confiables

1. Definir baselines.
2. Backtesting event-driven con fees/slippage.
3. Walk-forward validation.
4. Calibración Kalman.
5. Sustituir o reformular Transformer.

### Fase 4 — Escalabilidad

1. Cache Redis o LRU según escala.
2. Worker/service para análisis pesado.
3. Time-series strategy.
4. Socket.io horizontal.
5. Observabilidad completa.

---

## 7. Alternativas arquitectónicas con tradeoffs

### Opción A — Modular monolith disciplinado

**Qué es:** mantener un solo backend, pero separar dominios internamente con capas claras.

**Pros:** menor complejidad operativa, ideal para estabilizar rápido.  
**Contras:** escalado independiente limitado.  
**Recomendación:** mejor opción inmediata.

### Opción B — API + workers

**Qué es:** API Express para requests; worker(s) para agent, análisis y backtesting.

**Pros:** evita bloquear API con cálculos/agent; transición razonable.  
**Contras:** requiere cola, lifecycle y observabilidad.  
**Recomendación:** objetivo de mediano plazo.

### Opción C — Microservicios completos

**Qué es:** user-service, market-data-service, analysis-service, trading-agent-service.

**Pros:** escala y despliegue independiente.  
**Contras:** alto costo operacional; prematuro si tests/contratos están rotos.  
**Recomendación:** NO todavía. Primero fundamentos.

---

## 8. Checklist de próximos requerimientos técnicos

- [ ] Definir PRD de producto.
- [ ] Definir modos operativos del bot.
- [ ] Definir criterios de “producción”.
- [ ] Crear OpenAPI.
- [ ] Crear threat model.
- [ ] Corregir lint config.
- [ ] Reparar test runner.
- [ ] Agregar tests auth/ownership.
- [ ] Crear logger estructurado.
- [ ] Implementar error middleware.
- [ ] Diseñar backtesting/paper trading.
- [ ] Diseñar estrategia time-series.
- [ ] Decidir estrategia de tokens.
- [ ] Auditar ownership de todas las rutas.
- [ ] Auditar y corregir README/licencia.

---

## 9. Conclusión técnica

El proyecto NO está perdido. Tiene mucho trabajo ya hecho y módulos ambiciosos. Pero ahora toca actuar como arquitectos, no como coleccionistas de features. Si se sigue agregando complejidad encima de lint roto, tests rotos y modelos predictivos sin validación, el sistema se vuelve una torre bonita pero frágil.

La prioridad correcta es:

1. Calidad ejecutable.
2. Seguridad y ownership.
3. Contratos.
4. Backtesting y validación.
5. Rendimiento.
6. Escalabilidad.
7. Recién después, algoritmos avanzados y live trading.

CONCEPTOS > CÓDIGO. Primero fundamentos, luego velocidad.
