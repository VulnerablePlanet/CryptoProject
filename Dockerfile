# Multi-stage Dockerfile for Crypto Market Anomaly Detector
# Stage 1: Build frontend
# Stage 2: Production runtime

# ============================================================================
# STAGE 1 — Build Frontend
# ============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
RUN npm ci --only=production=false

# Copy source and build
COPY . .
RUN npm run build

# ============================================================================
# STAGE 2 — Production Runtime
# ============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy server package files
COPY server/package.json server/package-lock.json ./
RUN npm ci --only=production

# Copy server source
COPY server/ ./

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Expose backend port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Use dumb-init for proper signal handling (SIGTERM/SIGINT)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
