/**
 * server.ts
 * Main Express application server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import logger from './utils/logger';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import projectsRoutes from './modules/projects/projects.routes';
import transactionsRoutes from './modules/transactions/transactions.routes';
import advancesRoutes from './modules/advances/advances.routes';
import receiptsRoutes from './modules/receipts/receipts.routes';
import importRoutes from './modules/import/import.routes';

// Country data endpoint
import { COUNTRIES } from './core/countries';

const prisma = new PrismaClient();
const app = express();
const PORT = parseInt(process.env.PORT ?? '3001');

// ─────────────────────────────────────────
// Security Middleware
// ─────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Handled by Next.js frontend
  })
);

const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
app.use(
  cors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { success: false, error: 'Zbyt wiele żądań. Spróbuj ponownie za chwilę.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter for auth endpoints
  message: { success: false, error: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' },
});

app.use('/api/', apiLimiter);
app.use('/api/v1/auth', authLimiter);

// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────

const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, usersRoutes);
app.use(`${API_PREFIX}/projects`, projectsRoutes);
app.use(`${API_PREFIX}/transactions`, transactionsRoutes);
app.use(`${API_PREFIX}/advances`, advancesRoutes);
app.use(`${API_PREFIX}/receipts`, receiptsRoutes);
app.use(`${API_PREFIX}/import`, importRoutes);

// Countries list (public endpoint - no auth needed)
app.get(`${API_PREFIX}/countries`, (_req, res) => {
  res.json({ success: true, data: COUNTRIES });
});

// Health check
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: 'connected',
    });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ─────────────────────────────────────────
// Error Handler
// ─────────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });

    if (err.message.includes('Multer')) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Wewnętrzny błąd serwera.',
    });
  }
);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint nie znaleziony.' });
});

// ─────────────────────────────────────────
// Startup
// ─────────────────────────────────────────

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Delegacje API server running`, {
        port: PORT,
        env: process.env.NODE_ENV ?? 'development',
        corsOrigin,
      });
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

void start();

export default app;
