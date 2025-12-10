/**
 * Hail-Mary API Server
 * 
 * Main entry point for the backend API.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './db/schema';
import { db } from './db/drizzle-client';
import { users } from './db/drizzle-schema';
import { isGoogleAuthEnabled } from './config/passport';

// Import routes
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import customersRouter from './routes/customers';
import productsRouter from './routes/products';
import quotesRouter from './routes/quotes';
import leadsRouter from './routes/leads';
import appointmentsRouter from './routes/appointments';
import visitSessionsRouter from './routes/visitSessions';
import filesRouter from './routes/files';
import transcriptionRouter from './routes/transcription';
import depotNotesRouter from './routes/depotNotes';
import surveyHelperRouter from './routes/surveyHelper';

// API version - kept in sync with package.json
const API_VERSION = '0.2.0';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize database (PostgreSQL via Drizzle ORM)
initializeDatabase();

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use('/api', limiter); // Apply rate limiting to API routes

// Health check endpoints are intentionally NOT rate-limited to allow
// monitoring systems (load balancers, container orchestrators, etc.)
// to check service health frequently without being blocked.
// These endpoints only expose non-sensitive status information.

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || API_VERSION,
  });
});

// Detailed health check endpoint with configuration status
app.get('/health/detailed', async (_req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || API_VERSION,
    uptime: process.uptime(),
    config: {
      googleAuth: isGoogleAuthEnabled() ? 'enabled' : 'disabled',
      nasAuthMode: process.env.NAS_AUTH_MODE === 'true' ? 'enabled' : 'disabled',
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    database: 'unknown',
  };

  try {
    await db.select().from(users).limit(1);
    health.database = 'connected';
  } catch {
    health.database = 'disconnected';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Database health check endpoint
app.get('/health/db', async (_req, res) => {
  try {
    // Simple query: select users (or just an empty result if no users exist)
    const result = await db.select().from(users).limit(1);
    res.json({ ok: true, usersSample: result });
  } catch (err) {
    console.error('DB health check failed', err);
    res.status(500).json({ ok: false, error: 'DB connection failed' });
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/visit-sessions', visitSessionsRouter);
app.use('/api/files', filesRouter);
app.use('/api/transcription', transcriptionRouter);
app.use('/api/depot-notes', depotNotesRouter);
app.use('/api/survey-helper', surveyHelperRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 Hail-Mary API running on http://${HOST}:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📋 Health Endpoints:');
  console.log(`   GET /health          - Basic health check`);
  console.log(`   GET /health/detailed - Detailed health with config status`);
  console.log(`   GET /health/db       - Database connection check`);
  console.log('');
  console.log('🔐 Auth Endpoints:');
  console.log(`   POST /api/auth/register`);
  console.log(`   POST /api/auth/login`);
  console.log(`   POST /api/auth/logout`);
  console.log(`   GET  /api/auth/me`);
  console.log(`   POST /api/auth/request-password-reset`);
  console.log(`   POST /api/auth/reset-password`);
  if (isGoogleAuthEnabled()) {
    console.log(`   GET  /api/auth/google          (Google OAuth)`);
    console.log(`   GET  /api/auth/google/callback (Google OAuth)`);
  }
  if (process.env.NAS_AUTH_MODE === 'true') {
    console.log(`   GET  /api/auth/nas/users       (NAS quick login)`);
    console.log(`   POST /api/auth/nas/login       (NAS quick login)`);
  }
  console.log('');
  console.log('📊 API Endpoints:');
  console.log(`   /api/admin, /api/customers, /api/products, /api/quotes`);
  console.log(`   /api/leads, /api/appointments, /api/visit-sessions`);
  console.log(`   /api/files, /api/transcription, /api/depot-notes, /api/survey-helper`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

export default app;
