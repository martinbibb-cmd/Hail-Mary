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

// Import routes
import authRouter from './routes/auth';
import customersRouter from './routes/customers';
import productsRouter from './routes/products';
import quotesRouter from './routes/quotes';
import leadsRouter from './routes/leads';
import appointmentsRouter from './routes/appointments';
import visitSessionsRouter from './routes/visitSessions';
import filesRouter from './routes/files';
import transcriptionRouter from './routes/transcription';

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

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/visit-sessions', visitSessionsRouter);
app.use('/api/files', filesRouter);
app.use('/api/transcription', transcriptionRouter);

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
  console.log(`🚀 Hail-Mary API running on http://${HOST}:${PORT}`);
  console.log(`   Health check: http://${HOST}:${PORT}/health`);
  console.log(`   DB health check: http://${HOST}:${PORT}/health/db`);
  console.log(`   API endpoints:`);
  console.log(`   - POST /api/auth/register, /api/auth/login, /api/auth/logout`);
  console.log(`   - GET /api/auth/me`);
  console.log(`   - POST /api/auth/request-password-reset, /api/auth/reset-password`);
  console.log(`   - GET/POST /api/customers`);
  console.log(`   - GET/POST /api/products`);
  console.log(`   - GET/POST /api/quotes`);
  console.log(`   - GET/POST /api/leads`);
  console.log(`   - GET/POST /api/appointments`);
  console.log(`   - GET/POST /api/visit-sessions`);
  console.log(`   - GET/POST/DELETE /api/files`);
  console.log(`   - POST/GET /api/transcription/sessions`);
});

export default app;
