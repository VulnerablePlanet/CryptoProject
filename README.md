# 🚀 Crypto Market Anomaly Detector

> Plataforma avanzada de análisis de mercados de criptomonedas con predicciones basadas en Machine Learning, análisis técnico Fibonacci, filtros Kalman, y trading en tiempo real multi-exchange.

---

## 📋 Tabla de Contenidos

- [Tecnologías](#-tecnologías)
- [Arquitectura](#-arquitectura)
- [Estructura de Carpetas](#-estructura-de-carpetas)
- [Base de Datos](#-base-de-datos)
- [Módulos del Frontend](#-módulos-del-frontend)
- [Módulos del Backend](#-módulos-del-backend)
- [API Endpoints](#-api-endpoints)
- [Algoritmos](#-algoritmos)
- [Seguridad](#-seguridad)
- [WebSocket (Tiempo Real)](#-websocket-tiempo-real)
- [Configuración y Ejecución](#-configuración-y-ejecución)
- [Estado Actual del Proyecto](#-estado-actual-del-proyecto)

---

## 🛠 Tecnologías

### Frontend
| Tecnología | Versión | Propósito |
|---|---|---|
| **Vue.js 3** | ^3.4.35 | Framework UI con `<script setup>` SFC |
| **Vite** | ^8.0 | Build tool y dev server |
| **Pinia** | ^3.0.4 | State management |
| **Vue Router** | ^4.6.3 | Enrutamiento SPA |
| **TailwindCSS** | ^4.1.17 | Framework CSS utility-first |
| **Lightweight Charts** | ^4.1.0 | Gráficos de velas (TradingView) |
| **Socket.io Client** | ^4.8.1 | WebSocket para datos en tiempo real |
| **Axios** | ^1.13.2 | Cliente HTTP |
| **@vueuse/core** | ^14.1.0 | Utilidades de composición Vue |

### Backend
| Tecnología | Versión | Propósito |
|---|---|---|
| **Node.js + Express** | ^5.2.1 | Servidor HTTP y API REST |
| **MongoDB + Mongoose** | ^9.6.1 | Base de datos NoSQL y ODM (replica set recomendado: transacciones del ledger) |
| **Socket.io** | ^4.7.2 | WebSocket server |
| **CCXT** | ^4.5.30 | Librería unificada multi-exchange |
| **JWT (jsonwebtoken)** | ^9.0.2 | Autenticación por tokens |
| **bcryptjs** | ^2.4.3 | Hash de contraseñas |
| **express-validator** | ^7.0.1 | Validación de inputs |
| **Multer** | ^2.0.2 | Upload de archivos |
| **dotenv** | ^16.3.1 | Variables de entorno |
| **concurrently** | ^9.2.1 | Ejecución paralela dev servers |

### APIs Externas
| API | Propósito |
|---|---|
| **CoinGecko API** | Datos de mercado, precios, gráficos |
| **CCXT (Binance, etc.)** | OHLCV, order book, ticker de 10+ exchanges |

---

## 🏗 Arquitectura

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Vue 3 + Vite)                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │   Views    │  │ Components │  │   Stores   │  │  Services  │ │
│  │ (22 vistas)│  │ (9 grupos) │  │ (14 Pinia) │  │ (10 APIs)  │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘ │
│        └────────────────┴──────────────┴────────────────┘        │
│                           │ HTTP / WebSocket                     │
└───────────────────────────┼──────────────────────────────────────┘
                            │ Vite Proxy (/api → :5000)
┌───────────────────────────┼──────────────────────────────────────┐
│                    SERVIDOR (Node.js + Express)                   │
│  ┌─────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │  Routes │  │Controllers │  │  Services  │  │  Middleware  │  │
│  │(14 mods)│  │ (11 mods)  │  │ (12 mods)  │  │ (auth+upload)│  │
│  └────┬────┘  └─────┬──────┘  └─────┬──────┘  └──────────────┘  │
│       └─────────────┴──────────────┘                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │   Models    │  │   Socket.io  │  │   Trading Engine       │   │
│  │ (8 schemas) │  │  (real-time) │  │ (talib + trading mods) │   │
│  └──────┬──────┘  └──────────────┘  └────────────────────────┘   │
│         │                                                         │
└─────────┼─────────────────────────────────────────────────────────┘
          │
┌─────────▼─────────┐
│  MongoDB (local)   │
│ coingecko-app DB   │
└────────────────────┘
```

### Patrón de Diseño
- **Frontend**: Composition API + Pinia stores (flujo unidireccional de datos)
- **Backend**: Routes → Controllers → Services → Models. Reglas de negocio puras en `server/domain/` (p. ej. el ledger de cartera); el agente de trading en `server/trading/agent/` con su runtime y su pasarela de exchange
- **Comunicación**: REST API + WebSocket (Socket.io) para datos en tiempo real
- **Proxy**: en desarrollo Vite redirige `/api` → `localhost:5000`. CoinGecko se consulta siempre a través del backend (`/api/coingecko`, con rate limit y API key del servidor)

---

## 📁 Estructura de Carpetas

```
CryptoProject/
├── 📄 .env                         # Variables de entorno
├── 📄 index.html                   # Punto de entrada HTML
├── 📄 package.json                 # Dependencias frontend
├── 📄 vite.config.js               # Configuración Vite + proxy
├── 📄 postcss.config.js            # PostCSS pipelines
│
├── 📂 src/                         # ── FRONTEND ──
│   ├── 📄 main.js                  # Bootstrap: Pinia + Router + Mount
│   ├── 📄 App.vue                  # Componente raíz
│   │
│   ├── 📂 assets/                  # Recursos estáticos
│   │   └── 📄 main.css             # Design tokens (@theme) + estilos globales + Tailwind
│   │
│   ├── 📂 router/                  # Enrutamiento
│   │   └── 📄 index.js             # 19 rutas + navigation guards
│   │
│   ├── 📂 views/                   # Vistas/Páginas (22)
│   │   ├── HomePage.vue            # Landing page
│   │   ├── LoginPage.vue           # Autenticación
│   │   ├── RegisterPage.vue        # Registro
│   │   ├── DashboardContent.vue    # Panel principal
│   │   ├── TradingContent.vue      # Trading básico
│   │   ├── ProTradingContent.vue   # Trading profesional
│   │   ├── WalletContent.vue       # Billetera/Portfolio
│   │   ├── TransactionsContent.vue # Historial transacciones
│   │   ├── WatchlistContent.vue    # Lista de seguimiento + alertas
│   │   ├── FibonacciContent.vue    # Análisis Fibonacci (CoinGecko)
│   │   ├── FibonacciCcxtContent.vue# Fibonacci con CCXT
│   │   ├── PredictionsContent.vue  # Predicciones ML
│   │   ├── TradingViewContent.vue  # Gráficos interactivos
│   │   ├── TechnicalAnalysisContent.vue # Indicadores técnicos
│   │   ├── TALibContent.vue        # TA-Lib avanzado
│   │   ├── LearnContent.vue        # Educación crypto
│   │   ├── SecurityContent.vue     # Configuración seguridad
│   │   ├── ProfileContent.vue      # Perfil de usuario
│   │   ├── ApiKeysContent.vue      # Gestión API keys
│   │   ├── UsersContent.vue        # Administración usuarios
│   │   └── DocsContent.vue         # Documentación API
│   │
│   ├── 📂 components/              # Componentes reutilizables (41)
│   │   ├── 📂 common/              # Genéricos
│   │   │   ├── LoadingSpinner.vue
│   │   │   ├── RealtimeIndicator.vue
│   │   │   └── ThemeToggle.vue
│   │   ├── 📂 layout/              # Estructura visual
│   │   │   ├── AppSidebar.vue
│   │   │   ├── AuthLayout.vue
│   │   │   └── DashboardHeader.vue
│   │   ├── 📂 crypto/              # Datos de mercado
│   │   │   ├── AssetTable.vue
│   │   │   ├── CandlestickChart.vue
│   │   │   ├── CryptoCard.vue
│   │   │   └── PriceChart.vue
│   │   ├── 📂 predictions/         # Predicciones ML
│   │   │   ├── PredictionChart.vue
│   │   │   ├── PredictionStats.vue
│   │   │   ├── CryptoSelector.vue
│   │   │   ├── ExchangeSelector.vue
│   │   │   ├── TimeframeSelector.vue
│   │   │   └── MethodologyInfo.vue
│   │   ├── 📂 protrading/          # Trading profesional
│   │   │   ├── ProTradingChart.vue
│   │   │   ├── DepthChart.vue
│   │   │   ├── OscillatorPanel.vue
│   │   │   ├── IndicatorSettings.vue
│   │   │   ├── ChartControls.vue
│   │   │   ├── ExchangeSelector.vue
│   │   │   └── SymbolSelector.vue
│   │   ├── 📂 tradingview/         # Gráficos TradingView
│   │   │   ├── TradingViewChart.vue
│   │   │   ├── PriceDisplay.vue
│   │   │   ├── CoinSelector.vue
│   │   │   ├── TimeframeSelector.vue
│   │   │   └── ChartTypeSelector.vue
│   │   ├── 📂 fibonacci/           # Análisis Fibonacci
│   │   │   ├── FibonacciChart.vue
│   │   │   └── FibonacciLevels.vue
│   │   ├── 📂 trading/             # Trading básico
│   │   │   ├── OrderBook.vue
│   │   │   └── TradePanel.vue
│   │   └── 📂 wallet/              # Billetera
│   │       ├── BalanceCard.vue
│   │       ├── AddHoldingModal.vue
│   │       ├── ActivityList.vue
│   │       └── QuickTradeWidget.vue
│   │
│   ├── 📂 stores/                  # Estado global Pinia (14)
│   │   ├── auth.js                 # Autenticación + JWT
│   │   ├── crypto.js               # Datos de mercado
│   │   ├── portfolio.js            # Portfolio del usuario
│   │   ├── transactions.js         # Historial de transacciones
│   │   ├── watchlist.js            # Lista de seguimiento
│   │   ├── notifications.js        # Notificaciones
│   │   ├── fibonacci.js            # Estado Fibonacci
│   │   ├── fibonacciCcxt.js        # Fibonacci CCXT
│   │   ├── predictions.js          # Predicciones ML
│   │   ├── proTrading.js           # Pro trading
│   │   ├── tradingview.js          # TradingView charts
│   │   ├── talib.js                # TA-Lib indicadores
│   │   ├── theme.js                # Tema claro/oscuro
│   │   └── ui.js                   # Estado UI (sidebar, etc.)
│   │
│   ├── 📂 services/                # Servicios/API (10)
│   │   ├── api.js                  # Axios instance + interceptors
│   │   ├── coingecko.js            # CoinGecko API client
│   │   ├── ccxt.js                 # CCXT exchange client
│   │   ├── ccxtPrice.js            # Precio via CCXT
│   │   ├── socket.js               # Socket.io client
│   │   ├── fibonacciService.js     # Fibonacci API calls
│   │   ├── fibonacciCcxtService.js # Fibonacci CCXT calls
│   │   ├── talibService.js         # TA-Lib API calls
│   │   ├── tradingview.js          # TradingView data
│   │   └── ohlc.js                 # OHLC API (velas CoinGecko en MongoDB)
│   │
│   └── 📂 utils/                   # Utilidades (4)
│       ├── technicalIndicators.js  # RSI, SMA, EMA, MACD (client-side)
│       ├── fibonacci.js            # Cálculos Fibonacci client-side
│       ├── currency.js             # Formateo de monedas
│       └── heikinAshi.js           # Velas Heikin-Ashi
│
├── 📂 server/                      # ── BACKEND ──
│   ├── 📄 index.js                 # Entry point: Express + Socket.io
│   ├── 📄 package.json             # Dependencias backend
│   │
│   ├── 📂 config/
│   │   ├── 📄 db.js                # Conexión MongoDB/Mongoose (+ detección de transacciones)
│   │   └── 📄 env.js               # Validación de configuración, modo de trading, ruta de uploads
│   │
│   ├── 📂 domain/
│   │   └── 📄 portfolioLedger.js   # Reglas puras de cartera (coste medio, ventas, reversión)
│   │
│   ├── 📂 middleware/
│   │   ├── 📄 auth.js              # JWT auth + optional auth
│   │   └── 📄 upload.js            # Multer (avatar upload, 5MB max)
│   │
│   ├── 📂 models/                  # Esquemas Mongoose (8; el agente define 4 más en trading/agent/models)
│   │   ├── User.js
│   │   ├── Portfolio.js
│   │   ├── Transaction.js
│   │   ├── Watchlist.js
│   │   ├── Notification.js
│   │   ├── ApiKey.js
│   │   ├── Candle.js
│   │   └── RefreshToken.js
│   │
│   ├── 📂 controllers/             # Controladores (10)
│   │   ├── authController.js
│   │   ├── portfolioController.js
│   │   ├── transactionController.js
│   │   ├── watchlistController.js
│   │   ├── notificationController.js
│   │   ├── tradingController.js
│   │   ├── fibonacciController.js
│   │   ├── fibonacciCcxtController.js
│   │   ├── talibController.js
│   │   └── ohlcController.js
│   │
│   ├── 📂 routes/                  # Rutas API (15)
│   │   ├── auth.js                 # /api/auth
│   │   ├── portfolio.js            # /api/portfolio
│   │   ├── transactions.js         # /api/transactions
│   │   ├── watchlist.js            # /api/watchlist
│   │   ├── notifications.js        # /api/notifications
│   │   ├── trading.js              # /api/trading
│   │   ├── fibonacci.js            # /api/fibonacci
│   │   ├── fibonacciCcxt.js        # /api/fibonacci-ccxt
│   │   ├── talib.js                # /api/talib
│   │   ├── ohlc.js                 # /api/ohlc
│   │   ├── exchange.js             # /api/exchange
│   │   ├── apikeys.js              # /api/apikeys
│   │   ├── predictions.js          # /api/predictions
│   │   ├── agent.js                # /api/agent (solo admin)
│   │   └── coingecko.js            # /api/coingecko (proxy con lista blanca + caché)
│   │
│   ├── 📂 services/                # Lógica de negocio (13)
│   │   ├── predictionService.js    # Kalman + Holt (suavizado exponencial doble)
│   │   ├── kalmanService.js        # Filtro Kalman 2D
│   │   ├── fibonacciService.js     # Análisis Fibonacci + ZigZag
│   │   ├── fibonacciCcxtService.js # Fibonacci via exchanges CCXT
│   │   ├── confluenceService.js    # Confluencia de indicadores técnicos
│   │   ├── ccxtService.js          # CCXT acceso multi-exchange
│   │   ├── ccxtPriceService.js     # Precios vía CCXT
│   │   ├── ohlcService.js          # Datos OHLCV + caché
│   │   ├── priceService.js         # Servicio de precios periódico
│   │   ├── alertMonitoringService.js # Monitoreo de alertas de precio
│   │   ├── coingeckoRateLimiter.js # Rate limiter CoinGecko
│   │   └── ledgerService.js        # Transacciones + cartera (atómico / compensado)
│   │
│   ├── 📂 socket/
│   │   └── 📄 index.js             # Socket.io setup + auth + rooms
│   │
│   ├── 📂 trading/                 # Motor de trading avanzado
│   │   ├── 📂 backtesting/         # Backtesting de estrategias
│   │   ├── 📂 context/             # Contexto de mercado
│   │   ├── 📂 data/                # Gestión de datos
│   │   ├── 📂 agent/               # Agente autónomo (orchestrator, fases, kill switch,
│   │   │                           #   runtime, exchangeGateway, modelos)
│   │   ├── 📂 indicators/          # index.js: indicadores sobre `technicalindicators`
│   │   ├── 📂 levels/              # Niveles de soporte/resistencia
│   │   ├── 📂 mtf/                 # Multi-timeframe analysis
│   │   ├── 📂 priceAction/         # Price action analysis
│   │   └── 📂 signals/             # Señales de trading
│   │
│   └── 📂 talib/                   # TA-Lib engine avanzado
│       ├── 📄 index.js             # Motor principal
│       ├── 📄 config.js            # Configuración
│       ├── 📄 types.js             # Tipos y definiciones
│       ├── 📂 adaptive/            # Indicadores adaptativos
│       ├── 📂 analysis/            # Análisis de mercado
│       ├── 📂 backtest/            # Backtesting
│       ├── 📂 divergence/          # Detección de divergencias
│       ├── 📂 indicators/          # Indicadores base
│       ├── 📂 ml/                  # Machine learning
│       ├── 📂 mtf/                 # Multi-timeframe
│       ├── 📂 orderbook/           # Análisis order book
│       ├── 📂 patterns/            # Patrones de velas
│       ├── 📂 regimes/             # Regímenes de mercado
│       ├── 📂 risk/                # Gestión de riesgo
│       ├── 📂 scoring/             # Sistema de puntuación
│       ├── 📂 stops/               # Stop loss/take profit
│       ├── 📂 structure/           # Estructura de mercado
│       ├── 📂 utils/               # Utilidades
│       └── 📂 volume/              # Análisis de volumen
│
├── 📂 public/                      # Archivos públicos
│   └── 📂 uploads/                 # Avatares de usuario
│
└── 📂 dist/                        # Build de producción
```

---

## 🗄 Base de Datos

**Motor**: MongoDB (Mongoose ODM)  
**URI**: `mongodb://localhost:27017/coingecko-app`

### Colecciones / Modelos (8)

#### 1. `User` — Usuarios
| Campo | Tipo | Descripción |
|---|---|---|
| `name` | String | Nombre (2-50 chars) |
| `email` | String | Email único, lowercase |
| `password` | String | Hash bcrypt (salt 12), excluido de queries |
| `avatar` | String | URL de imagen de perfil |
| `phone` | String | Teléfono |
| `birthDate` | Date | Fecha de nacimiento |
| `location` | String | Ubicación |
| `bio` | String | Biografía (max 500 chars) |
| `socialLinks` | Object | GitHub, Twitter, LinkedIn, Website |
| `settings` | Object | Moneda, tema, notificaciones, chartSettings |
| `createdAt/updatedAt` | Date | Timestamps automáticos |

**Hooks**: Pre-save hash de contraseña con bcrypt (salt 12).  
**Métodos**: `comparePassword()`, `toJSON()` (elimina password).

#### 2. `Portfolio` — Portafolio
| Campo | Tipo | Descripción |
|---|---|---|
| `user` | ObjectId → User | Propietario (único por usuario) |
| `holdings[]` | Array | Lista de criptomonedas mantenidas |
| `holdings.coinId` | String | ID moneda (ej: "bitcoin") |
| `holdings.symbol` | String | Símbolo (ej: "BTC") |
| `holdings.amount` | Number | Cantidad |
| `holdings.avgBuyPrice` | Number | Precio promedio de compra |
| `totalInvested` | Number | Inversión total |

**Métodos**: `addHolding()` con cálculo de precio promedio ponderado.

#### 3. `Transaction` — Transacciones
| Campo | Tipo | Descripción |
|---|---|---|
| `user` | ObjectId → User | Propietario |
| `type` | Enum | buy, sell, transfer_in, transfer_out, deposit, withdraw |
| `coinId/symbol/coinName` | String | Identificación de la moneda |
| `amount` | Number | Cantidad |
| `priceAtTransaction` | Number | Precio al momento |
| `totalValue` | Number | Valor total |
| `fee` | Number | Comisión |
| `status` | Enum | pending, completed, failed, cancelled |
| `exchange` | String | Exchange origen (default: binance) |
| `tradingPair` | String | Par de trading (ej: "BTC/USDT") |
| `fromAddress/toAddress/txHash` | String | Info de transferencia |

**Índices**: `{user, createdAt}`, `{user, coinId}`, `{user, type}`.

#### 4. `Watchlist` — Lista de Seguimiento
| Campo | Tipo | Descripción |
|---|---|---|
| `user` | ObjectId → User | Propietario (único por usuario) |
| `coins[]` | Array | Monedas en seguimiento |
| `coins.exchange` | String | Exchange para precios |
| `coins.tradingPair` | String | Par de trading |
| `alerts[]` | Array | Alertas de precio |
| `alerts.targetPrice` | Number | Precio objetivo |
| `alerts.condition` | Enum | above, below |
| `alerts.active/triggered` | Boolean | Estado de la alerta |

**Métodos**: `hasCoin()`, `getActiveAlerts()`.

#### 5. `Notification` — Notificaciones
| Campo | Tipo | Descripción |
|---|---|---|
| `user` | ObjectId → User | Destinatario |
| `type` | Enum | price_alert, transaction, security, system, portfolio, welcome |
| `title/message` | String | Contenido |
| `read` | Boolean | Estado de lectura |
| `data` | Object | Datos asociados (coinId, precio, etc.) |
| `expiresAt` | Date | TTL (auto-eliminación) |

**Índices**: TTL index en `expiresAt`.  
**Statics**: `createAndEmit()` — crea y emite por Socket.io.

#### 6. `ApiKey` — Claves API
| Campo | Tipo | Descripción |
|---|---|---|
| `userId` | ObjectId → User | Propietario |
| `name` | String | Nombre descriptivo |
| `key` | String | Hash bcrypt de la clave |
| `keyPreview` | String | Preview (sk_live_xxxx...yyyy) |
| `provider` | String | Proveedor (default: Custom) |
| `rateLimit` | String | Límite de peticiones |
| `active` | Boolean | Estado |

**Hooks**: Pre-save hash bcrypt (salt 12) de la clave. La clave original no se puede recuperar, por lo que hoy no se usa para llamadas salientes (los exchanges usan variables de entorno).  
**Statics**: `generateKey()` (crypto.randomBytes 24), `createPreview()`.

#### 7. `Candle` — Datos OHLCV
| Campo | Tipo | Descripción |
|---|---|---|
| `coinId` | String | Moneda |
| `vsCurrency` | String | Moneda de cotización |
| `timeframe` | Enum | 5m, 15m, 30m, 1h, 4h, 1d |
| `timestamp` | Date | Apertura de la vela |
| `open/high/low/close` | Number | Datos OHLC |
| `volume` | Number | Volumen |
| `priceChange/priceChangePercent` | Number | Variación |

**Índices**: Compound unique `{coinId, vsCurrency, timeframe, timestamp}`.  
**Statics**: `getLatestCandle()`, `getCandlesInRange()`, `upsertCandles()` (bulk write).

#### 8. `RefreshToken` — Tokens de Refresco
| Campo | Tipo | Descripción |
|---|---|---|
| `token` | String | Token único (crypto.randomBytes 64) |
| `user` | ObjectId → User | Usuario asociado |
| `expiresAt` | Date | Expiración (7 días default) |
| `userAgent` | String | Info del navegador |
| `ipAddress` | String | IP del cliente |

**Índices**: TTL index en `expiresAt` (auto-eliminación).  
**Statics**: `generateToken()`, `createToken()`, `findValidToken()`, `revokeToken()`, `revokeAllUserTokens()`.

---

## 🖥 Módulos del Frontend

### Views (22 páginas)

| Vista | Ruta | Auth | Descripción |
|---|---|---|---|
| `HomePage` | `/` | ❌ | Landing page |
| `LoginPage` | `/login` | ❌ (guest) | Formulario de login |
| `RegisterPage` | `/register` | ❌ (guest) | Formulario de registro |
| `DashboardContent` | `/dashboard` | ✅ | Panel principal con resumen |
| `TradingContent` | `/trading` | ✅ | Trading básico (order book) |
| `ProTradingContent` | `/pro-trading` | ✅ | Trading profesional (indicadores avanzados) |
| `WalletContent` | `/wallet` | ✅ | Billetera y portfolio |
| `TransactionsContent` | `/transactions` | ✅ | Historial de operaciones |
| `WatchlistContent` | `/watchlist` | ✅ | Lista de seguimiento + alertas |
| `FibonacciContent` | `/fibonacci` | ✅ | Análisis Fibonacci (CoinGecko) |
| `FibonacciCcxtContent` | `/fibonacci-ccxt` | ✅ | Fibonacci con datos CCXT |
| `PredictionsContent` | `/predictions` | ✅ | Predicciones con ML |
| `TradingViewContent` | `/tradingview` | ✅ | Gráficos interactivos |
| `TechnicalAnalysisContent` | `/technical-analysis` | ✅ | Indicadores técnicos |
| `TALibContent` | `/talib` | ✅ | TA-Lib avanzado |
| `LearnContent` | `/learn` | ✅ | Educación crypto |
| `SecurityContent` | `/security` | ✅ | Config seguridad |
| `ProfileContent` | `/profile` | ✅ | Perfil de usuario |
| `ApiKeysContent` | `/settings/api-keys` | ✅ | Gestión de API keys |
| `UsersContent` | `/settings/users` | ✅ | Admin usuarios |
| `DocsContent` | `/docs` | ✅ | Documentación API |

### Stores Pinia (14)

| Store | Estado Principal |
|---|---|
| `auth` | Token JWT, usuario, login/register/refresh |
| `crypto` | Datos de mercado CoinGecko |
| `portfolio` | Holdings del usuario |
| `transactions` | Historial de transacciones |
| `watchlist` | Coins en seguimiento + alertas |
| `notifications` | Notificaciones del usuario |
| `fibonacci` | Estado del análisis Fibonacci |
| `fibonacciCcxt` | Fibonacci con datos CCXT |
| `predictions` | Resultados de predicciones ML |
| `proTrading` | Estado pro trading |
| `tradingview` | Configuración gráficos |
| `talib` | Indicadores TA-Lib |
| `theme` | Tema claro/oscuro |
| `ui` | Estado UI (sidebar colapsado, etc.) |

### Componentes (41 en 9 grupos)

| Grupo | Componentes | Propósito |
|---|---|---|
| `common/` | 4 | Spinner, indicador real-time, buscador, toggle tema |
| `layout/` | 4 | Header, sidebar, auth layout, dashboard header |
| `crypto/` | 4 | Tabla assets, velas, card, gráfico precios |
| `predictions/` | 7 | Gráfico predicción, stats, selectores |
| `protrading/` | 8 | Chart pro, depth, osciladores, indicadores |
| `tradingview/` | 6 | Chart TradingView, precio, selectores |
| `fibonacci/` | 2 | Gráfico y niveles Fibonacci |
| `trading/` | 2 | Order book, panel de trading |
| `wallet/` | 4 | Balance, modal holding, actividad, quick trade |

### Utilidades Frontend (4)

| Utilidad | Funciones |
|---|---|
| `technicalIndicators.js` | RSI, SMA, EMA, MACD, sparklines (cálculo client-side) |
| `fibonacci.js` | Cálculos Fibonacci, formateo, zonas de precio |
| `currency.js` | Formateo de monedas |
| `heikinAshi.js` | Transformación de velas Heikin-Ashi |

---

## ⚙ Módulos del Backend

### Controllers (10)

| Controller | Responsabilidad |
|---|---|
| `authController` | Registro, login, refresh token, perfil, upload avatar |
| `portfolioController` | CRUD holdings, balance |
| `transactionController` | CRUD transacciones, filtros |
| `watchlistController` | CRUD watchlist, alertas de precio |
| `notificationController` | Obtener, marcar leído, eliminar notificaciones |
| `tradingController` | Datos de mercado, order book, ticker via CCXT |
| `fibonacciController` | Análisis Fibonacci con CoinGecko |
| `fibonacciCcxtController` | Análisis Fibonacci con CCXT |
| `talibController` | Indicadores TA-Lib avanzados |
| `ohlcController` | Datos OHLCV y caché a MongoDB |

### Services (13)

| Servicio | Descripción |
|---|---|
| `predictionService` | Pipeline: Kalman → Holt (tendencia lineal) → predicciones |
| `kalmanService` | Filtro Kalman 2D (precio + velocidad) |
| `fibonacciService` | ZigZag pivots → Fibonacci retracement/extensión |
| `fibonacciCcxtService` | Fibonacci con datos CCXT multi-exchange |
| `confluenceService` | RSI + MACD + Bollinger + EMA + Volumen → señales |
| `ccxtService` | Acceso unificado a 10+ exchanges via CCXT |
| `ccxtPriceService` | Precios directos por exchange |
| `ohlcService` | Gestión datos OHLCV + caché MongoDB |
| `priceService` | Servicio periódico de actualización de precios |
| `alertMonitoringService` | Monitoreo continuo de alertas de precio |
| `coingeckoRateLimiter` | Rate limiter para CoinGecko API |
| `ledgerService` | Transacciones y cartera consistentes (transacción MongoDB o escritura compensada, concurrencia optimista) |

### Trading Engine (`server/trading/`)

Motor de trading avanzado con 9 sub-módulos:

| Módulo | Propósito |
|---|---|
| `agent/` | Agente autónomo de 5 fases, kill switch, runtime y pasarela de exchange |
| `indicators/` | ATR, Bollinger Bands, MACD, Momentum, Moving Averages, RSI (Wilder), VWAP — `index.js` |
| `backtesting/` | Simulación de estrategias en datos históricos |
| `context/` | Análisis de contexto de mercado |
| `data/` | Gestión y acceso a datos |
| `levels/` | Soporte y resistencia |
| `mtf/` | Análisis multi-timeframe |
| `priceAction/` | Análisis de acción del precio |
| `signals/` | Generación de señales de trading |

### TA-Lib Engine (`server/talib/`)

Motor de análisis técnico avanzado con 17 sub-módulos:

| Módulo | Propósito |
|---|---|
| `adaptive/` | Indicadores adaptativos |
| `analysis/` | Análisis general de mercado |
| `backtest/` | Motor de backtesting |
| `divergence/` | Detección de divergencias |
| `indicators/` | Indicadores base |
| `ml/` | Machine Learning |
| `mtf/` | Multi-timeframe |
| `orderbook/` | Análisis de libro de órdenes |
| `patterns/` | Patrones de velas |
| `regimes/` | Detección de regímenes de mercado |
| `risk/` | Gestión de riesgo |
| `scoring/` | Sistema de puntuación de señales |
| `stops/` | Stop loss / Take profit |
| `structure/` | Estructura de mercado |
| `utils/` | Utilidades |
| `volume/` | Análisis de volumen |

---

## 📡 API Endpoints

### Autenticación — `/api/auth`
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| POST | `/register` | ❌ | Registrar usuario |
| POST | `/login` | ❌ | Login con email/password |
| POST | `/refresh` | ❌ | Refrescar access token |
| POST | `/logout` | ✅ | Cerrar sesión |
| GET | `/me` | ✅ | Obtener perfil |
| PUT | `/profile` | ✅ | Actualizar perfil |
| POST | `/avatar` | ✅ | Subir avatar (Multer) |

### Portfolio — `/api/portfolio`
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| GET | `/` | ✅ | Obtener portfolio |
| POST | `/holdings` | ✅ | Agregar holding |
| PUT | `/holdings/:id` | ✅ | Actualizar holding |
| DELETE | `/holdings/:id` | ✅ | Eliminar holding |

### Transacciones — `/api/transactions`
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| GET | `/` | ✅ | Listar transacciones |
| POST | `/` | ✅ | Crear transacción |
| DELETE | `/:id` | ✅ | Eliminar transacción |

### Watchlist — `/api/watchlist`
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| GET | `/` | ✅ | Obtener watchlist |
| POST | `/coins` | ✅ | Agregar moneda |
| DELETE | `/coins/:coinId` | ✅ | Eliminar moneda |
| POST | `/alerts` | ✅ | Crear alerta |
| DELETE | `/alerts/:alertId` | ✅ | Eliminar alerta |

### Notificaciones — `/api/notifications`
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| GET | `/` | ✅ | Listar notificaciones |
| PUT | `/:id/read` | ✅ | Marcar como leída |
| DELETE | `/:id` | ✅ | Eliminar notificación |

### Trading — `/api/trading`
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| GET | `/markets/:exchange` | ✅ | Mercados disponibles |
| GET | `/ohlcv/:exchange/:symbol` | ✅ | Datos OHLCV |
| GET | `/orderbook/:exchange/:symbol` | ✅ | Libro de órdenes |
| GET | `/ticker/:exchange/:symbol` | ✅ | Ticker de precio |

### Fibonacci — `/api/fibonacci` y `/api/fibonacci-ccxt`
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| GET | `/analyze/:coinId` | ✅ | Análisis Fibonacci completo |
| GET | `/pivots/:coinId` | ✅ | Pivots ZigZag |

### TA-Lib — `/api/talib`
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| GET | `/analyze` | ✅ | Análisis con indicadores avanzados |

### Predictions — `/api/predictions`
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| GET | `/predict` | ✅ | Predicción ML completa |
| GET | `/kalman` | ✅ | Solo filtro Kalman |
| GET | `/forecast` | ✅ | Forecast rápido |

### Otros
| Ruta | Descripción |
|---|---|
| `/api/ohlc` | Datos OHLC con caché MongoDB |
| `/api/exchange` | Info de exchanges soportados |
| `/api/apikeys` | CRUD API keys del usuario |
| `/api/coingecko/*` | Proxy CoinGecko autenticado (lista blanca, caché 30 s) |
| `/api/agent/*` | Control del agente de trading (solo admin) |
| `/api/health` | Liveness (incluye estado de la BD) |
| `/api/health/ready` | Readiness: 503 si MongoDB no está disponible |

---

## 🧠 Algoritmos

### 1. Filtro Kalman 2D (`kalmanService.js`)
- **Tipo**: Filtro bayesiano recursivo de estado
- **Estado**: Vector 2D `[precio, velocidad]`
- **Proceso**: Predicción → Innovación → Actualización (Kalman Gain)
- **Matrices**: F (transición), H (observación), Q (ruido proceso), R (ruido medición), P (covarianza)
- **Uso**: Suavizado de series temporales de precios, eliminación de ruido de mercado
- **Output**: Precio suavizado, velocidad (tasa de cambio), intervalo de confianza

### 2. Holt — tendencia lineal (`predictionService.js`)
- **Tipo**: suavizado exponencial doble (método de Holt), determinista
- **Parámetros**: α = 0,25 (nivel), β = 0,10 (tendencia)
- **Entrada**: serie suavizada previamente con el filtro de Kalman
- **Horizonte**: 5 velas futuras
- **Confianza**: intervalos basados en la dispersión de los residuos
- Sustituye al antiguo "SimpleTransformer", que inicializaba pesos aleatorios y daba resultados distintos en cada arranque

### 3. Fibonacci ZigZag (`fibonacciService.js`)
- **Pivot Detection**: Algoritmo ZigZag con lookback window (default 5)
- **Noise Filter**: Threshold mínimo de cambio porcentual
- **Alternating Filter**: Garantiza secuencia High-Low alternante
- **Retracement**: Ratios 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%
- **Extensión**: Ratios 127.2% (TP1), 161.8% (TP2), 261.8% (TP3)
- **Trend Detection**: Basado en secuencia de pivots (Higher Highs/Lows)

### 4. Confluence Analysis (`confluenceService.js`)
- **Indicadores evaluados**:
  - RSI (14 períodos) — Sobrecompra (>70) / Sobreventa (<30)
  - MACD (12, 26, 9) — Cruces y divergencias
  - Bollinger Bands (20, 2σ) — Posición relativa
  - EMA Alignment — Confluencia con niveles Fibonacci
  - Volume Analysis — Spikes vs promedio
- **Scoring**: Ponderación de cada señal para generar señal compuesta
- **Trade Signals**: Generación automática basada en confluencia

### 5. Indicadores Técnicos
| Indicador | Cálculo |
|---|---|
| **RSI** | Relative Strength Index (Wilder's smoothing). Frontend y servidor dan el mismo valor (test de paridad) |
| **SMA** | Simple Moving Average |
| **EMA** | Exponential Moving Average (multiplier = 2/(period+1)) |
| **MACD** | EMA(12) - EMA(26), Signal = EMA(9) del MACD |
| **Bollinger Bands** | SMA(20) ± 2σ |
| **ATR** | Average True Range |
| **VWAP** | Volume Weighted Average Price |
| **Momentum** | Rate of change |
| **Heikin-Ashi** | Velas suavizadas (open/close promediados) |

---

## 🔐 Seguridad

### Autenticación
| Mecanismo | Implementación |
|---|---|
| **JWT Access Token** | Firmado con `JWT_SECRET`, expira en 15 min |
| **JWT Refresh Token** | crypto.randomBytes(64), expira en 7 días |
| **Password Hashing** | bcrypt con salt factor 12 |
| **API Key Hashing** | bcrypt (salt 12) |

### Middleware de Autenticación
- **`auth`**: Obligatorio — verifica JWT y adjunta usuario al request
- **`optionalAuth`**: Opcional — no falla si no hay token

### Protecciones
| Protección | Detalle |
|---|---|
| **CORS** | Configurado para `localhost:5173` (configurable via env) |
| **Token en Header** | `Authorization: Bearer <token>` |
| **Password excluido** | `select: false` en schema, eliminado en `toJSON()` |
| **Refresh Token Tracking** | Almacena `userAgent` e `ipAddress` |
| **TTL Auto-cleanup** | Tokens y notificaciones expirados se eliminan automáticamente |
| **File Upload** | Filtro MIME (solo imágenes), límite 5MB |
| **Rate Limiting** | Global (200 req/15 min en producción), login/registro/refresh, exchanges por usuario (IPv6 normalizado) y cola centralizada de CoinGecko |
| **Input Validation** | express-validator en rutas |
| **Graceful Shutdown** | Detiene precios y agente (cancela órdenes), cierra Socket.io, HTTP y MongoDB; sale con código 0 |
| **Configuración** | Validada al arrancar (`JWT_SECRET`, URI de MongoDB, `CORS_ORIGIN` en producción) |
| **CSP** | Helmet con imágenes de CoinGecko y Google Fonts permitidas |

### Rutas Protegidas
- Todas las rutas excepto `/`, `/login`, `/register` requieren autenticación
- Navigation guard en Vue Router verifica `authStore.isAuthenticated`
- Guest-only routes (`/login`, `/register`) redirigen a `/dashboard` si autenticado

---

## 📡 WebSocket (Tiempo Real)

### Servidor Socket.io
- **Autenticación**: Verifica JWT en handshake (permite guest sin auth)
- **Rooms**: `user:{userId}` (personal), `coin:{coinId}` (subscripciones)

### Eventos

| Evento | Dirección | Descripción |
|---|---|---|
| `connected` | Server → Client | Confirmación de conexión |
| `subscribe:prices` | Client → Server | Subscribir a precios de monedas |
| `unsubscribe:prices` | Client → Server | Desubscribir de precios |
| `priceUpdate` | Server → All | Actualización masiva de precios |
| `coinPrice` | Server → Room | Precio de moneda específica |
| `notification` | Server → User | Notificación personal |
| `alertTriggered` | Server → User | Alerta de precio activada |
| `portfolioUpdate` | Server → User | Actualización de portfolio |

### Servicio de Precios
- Actualización periódica automática via `priceService`
- Integración con `alertMonitoringService` para verificar alertas en cada actualización

---

## ⚡ Configuración y Ejecución

### Requisitos
- **Node.js** >= 18.x (CI y Docker usan 20)
- **MongoDB** 7 (local o Atlas). Se recomienda **replica set** (aunque sea de un nodo): el ledger de transacciones usa transacciones multi-documento; en un servidor *standalone* funciona con escrituras compensadas.
- **npm** >= 9.x

### Variables de Entorno (`.env`)
Ver `.env.example`. El servidor **valida la configuración al arrancar** y se niega a iniciar si falta algo obligatorio.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `JWT_SECRET` | Sí | ≥ 32 caracteres (obligatorio en producción; en desarrollo solo avisa) |
| `MONGODB_URI_LOCAL` / `MONGODB_URI_PROD` | Sí | URI según `NODE_ENV` |
| `CORS_ORIGIN` | En producción | Origen permitido del frontend |
| `PORT` | No | Por defecto 5000 |
| `COINGECKO_API_KEY` | No | Se envía desde el backend en `/api/coingecko` y en el servicio de precios |
| `UPLOADS_DIR` | No | Carpeta de avatares (por defecto `public/uploads`; en Docker `/app/uploads` con volumen) |
| `LOG_LEVEL` | No | `error`, `warn`, `info`, `debug` |
| `BINANCE_API_KEY` / `BINANCE_API_SECRET` | Para el agente | Credenciales del exchange |
| `BINANCE_MODE` | No | `sandbox` (testnet, por defecto) o `production` (dinero real). Cualquier otro valor equivale a `sandbox` |
| `AGENT_ALLOW_LIVE_TRADING` | No | Debe ser `true` **además** de `BINANCE_MODE=production` para operar con dinero real |
| `AGENT_OWNER_USER_ID` | No | Usuario con permisos de administrador sobre el agente |

### Instalación
```bash
# Instalar dependencias frontend
npm install

# Instalar dependencias backend
cd server && npm install && cd ..
```

### Ejecución
```bash
# Frontend + Backend simultáneo
npm run dev:all

# Solo frontend (Vite en :5173)
npm run dev

# Solo backend (Express en :5000)
npm run server

# Build de producción
npm run build

# Tests unitarios (rápidos, sin red)
npm test

# Tests de integración con MongoDB real en memoria (replica set y standalone).
# La primera ejecución descarga un binario de mongod.
npm run test:integration

# Producción con Docker (MongoDB como replica set de un nodo)
docker compose up --build
```

### 🤖 Agente de trading: seguridad
- **Por defecto opera en testnet** (`BINANCE_MODE=sandbox`). Todas las conexiones autenticadas (órdenes, cancelaciones, verificación de claves) pasan por `server/trading/agent/exchangeGateway.js`, que aplica el modo de forma consistente.
- **Dinero real requiere doble confirmación**: `BINANCE_MODE=production` **y** `AGENT_ALLOW_LIVE_TRADING=true`. Sin ambas, `POST /api/agent/start` responde 409.
- **Kill switch**: en cada ciclo se evalúan la pérdida diaria (3 %), el drawdown desde el máximo (10 %) y las pérdidas consecutivas (5) sobre el *equity* (capital + P&L no realizado), además de las alertas de volatilidad de la fase de monitorización. Al dispararse se detiene el bucle, se cancelan las órdenes abiertas y el estado se persiste: tras un reinicio el agente sigue bloqueado hasta `POST /api/agent/kill-switch/reset` (solo admin).
- **Limitación conocida**: la conciliación automática de posiciones cerradas con el exchange (TP/SL ejecutados → P&L realizado → capital) **no está implementada**. Por eso el modo real exige la confirmación explícita.

---

## 📊 Estado Actual del Proyecto

### ✅ Módulos Implementados

| Módulo | Estado | Archivos | Notas |
|---|---|---|---|
| **Autenticación** | ✅ Completo | Login, Register, JWT, Refresh, Profile | Incluye upload avatar |
| **Dashboard** | ✅ Completo | Vista principal con resumen | — |
| **Portfolio/Wallet** | ✅ Completo | Holdings CRUD, balance, quick trade | Precio promedio ponderado |
| **Transacciones** | ✅ Completo | Historial, filtros, CRUD | 6 tipos de transacción |
| **Watchlist** | ✅ Completo | Seguimiento, alertas de precio | Alertas above/below |
| **Notificaciones** | ✅ Completo | CRUD, Socket.io real-time, TTL | Auto-eliminación |
| **Trading Básico** | ✅ Completo | Order book, panel de trading | Via CCXT |
| **Pro Trading** | ✅ Completo | Gráfico avanzado, depth chart, oscillators | 8 componentes |
| **Fibonacci (CoinGecko)** | ✅ Completo | ZigZag, retracement, extensión, pivots | Confluence analysis |
| **Fibonacci (CCXT)** | ✅ Completo | Fibonacci multi-exchange | 10+ exchanges |
| **Predicciones** | ✅ Completo | Holt + Kalman | Determinista |
| **TradingView Charts** | ✅ Completo | Gráficos interactivos, multi-chart type | 6 componentes |
| **Technical Analysis** | ✅ Completo | RSI, SMA, EMA, MACD client-side | Sparklines |
| **TA-Lib Avanzado** | ✅ Completo | 17 sub-módulos especializados | Tests incluidos |
| **Trading Engine** | ✅ Completo | 9 sub-módulos (indicators, signals, etc.) | Backtesting |
| **API Keys** | ⚠️ Parcial | CRUD, hash bcrypt, preview | Las claves guardadas no se usan aún en llamadas salientes |
| **Security Settings** | ✅ Completo | Config de seguridad del usuario | — |
| **Users Admin** | ✅ Completo | Administración de usuarios | — |
| **Documentación** | ✅ Completo | Docs interactivos in-app | — |
| **Socket.io Real-time** | ✅ Completo | Precios, notificaciones, alertas | Auth en handshake |
| **Alert Monitoring** | ✅ Completo | Monitoreo continuo de precios | Auto-trigger |
| **Rate Limiting** | ✅ Completo | Global, auth, exchanges, CoinGecko | — |
| **Learn** | ✅ Completo | Contenido educativo | — |
| **Design System** | ✅ Completo | TailwindCSS custom, Inter/JetBrains Mono | Dark/Light theme |

### 📈 Métricas del Proyecto

| Métrica | Valor |
|---|---|
| **Vistas (pages)** | 22 |
| **Componentes Vue** | 41 |
| **Stores Pinia** | 14 |
| **Services Frontend** | 10 |
| **Utilidades Frontend** | 4 |
| **Modelos MongoDB** | 8 |
| **Controllers Backend** | 10 |
| **Routes Backend** | 15 |
| **Services Backend** | 13 |
| **Middlewares** | 2 |
| **Sub-módulos Trading** | 9 |
| **Sub-módulos TA-Lib** | 17 |

---

## 📝 Licencia

Este proyecto está bajo la licencia **GNU AGPL-3.0**. Ver el archivo [LICENSE](LICENSE) para más detalles.
