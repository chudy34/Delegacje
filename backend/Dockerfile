# Backend Dockerfile
# Multi-stage build for production

# ── Stage 1: Dependencies ──────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production

# ── Stage 2: Build ─────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src
RUN npm run build

# ── Stage 3: Runtime ───────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install Tesseract OCR and language packs
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-pol \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-deu \
    tesseract-ocr-data-fra \
    tesseract-ocr-data-spa

ENV NODE_ENV=production

# Create directories
RUN mkdir -p /app/uploads /app/logs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY package.json ./

EXPOSE 3001

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app/uploads /app/logs
USER nodejs

CMD ["node", "dist/server.js"]
