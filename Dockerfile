# Multi-stage Dockerfile for Crypto Market Anomaly Detector
# Stage 1: Build frontend
# Stage 2: Production runtime

# ============================================================================
# STAGE 1 — Build Frontend
# ============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy root package files.
# --ignore-scripts: the root `postinstall` (cd server && npm install) cannot
# run here — server/ is not copied in this stage — and made the build fail.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

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
RUN npm ci --omit=dev

# Copy server source
COPY server/ ./

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/dist ./dist

ENV NODE_ENV=production \
    UPLOADS_DIR=/app/uploads

# Create non-root user for security, plus a writable uploads directory
# (mount a volume here to keep avatars across container restarts)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/uploads/avatars && \
    chown -R nodejs:nodejs /app/uploads
USER nodejs

# Expose backend port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health/ready', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

# Use dumb-init for proper signal handling (SIGTERM/SIGINT)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
