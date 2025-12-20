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
import { generateCsrfToken, csrfProtection, csrfErrorHandler } from './middleware/csrf.middleware';
import { initializeDatabase } from './db/schema';
import { db } from './db/drizzle-client';
import { users } from './db/drizzle-schema';
import { isGoogleAuthEnabled } from './config/passport';
import { setSttProvider } from './services/stt.service';
import { WhisperSttProvider } from './services/whisperProvider.service';
import { getOpenaiApiKey } from './services/workerKeys.service';

// Import routes
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import nasRouter from './routes/nas';
import customersRouter from './routes/customers';
import productsRouter from './routes/products';
import quotesRouter from './routes/quotes';
import leadsRouter from './routes/leads';
import leadWorkspaceRouter from './routes/leadWorkspace';
import appointmentsRouter from './routes/appointments';
import visitSessionsRouter from './routes/visitSessions';
import filesRouter from './routes/files';
import transcriptionRouter from './routes/transcription';
import depotNotesRouter from './routes/depotNotes';
import surveyHelperRouter from './routes/surveyHelper';
import voiceNotesRouter from './routes/voiceNotes';
import rockyRouter from './routes/rocky';
import sarahRouter from './routes/sarah';
import voiceTransformRouter from './routes/voiceTransform';
import knowledgeRouter from './routes/knowledge';
import aiRouter from './routes/ai';
import sessionRouter from './routes/session';
import systemRecommendationsRouter from './routes/systemRecommendations';

// API version - kept in sync with package.json
export const API_VERSION = '0.2.0';

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Trust proxy - required when running behind nginx/Docker/Cloudflare
// This must be set before rate-limit middleware to prevent ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

// Initialize database (PostgreSQL via Drizzle ORM)
initializeDatabase();

// Initialize knowledge storage (create directories for PDF storage)
import { initializeStorage } from './services/knowledge.service';
initializeStorage().catch(err => {
  console.error('Failed to initialize knowledge storage:', err);
});

// Initialize STT provider based on environment configuration
// Try to get OpenAI API key from worker, fallback to environment variable
const initializeSttProvider = async () => {
  // Import appStatus for degraded mode tracking
  const { appStatus } = await import('./core/appStatus');
  
  if (process.env.USE_WHISPER_STT === 'true') {
    try {
      const openaiApiKey = await getOpenaiApiKey();
      if (openaiApiKey) {
        console.log('🎙️  Using OpenAI Whisper for transcription (key from worker)');
        setSttProvider(new WhisperSttProvider(openaiApiKey));
        return;
      }
    } catch (error) {
      console.warn('⚠️  Failed to get OpenAI key from worker, trying environment variable');
      const errorMsg = error instanceof Error ? error.message : String(error);
      appStatus.setDegraded('stt', `Failed to get OpenAI key from worker: ${errorMsg}`);
    }
    
    // Fallback to environment variable
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('🎙️  Using OpenAI Whisper for transcription (key from environment)');
        setSttProvider(new WhisperSttProvider(process.env.OPENAI_API_KEY));
        return;
      } catch (error) {
        console.warn('⚠️  Failed to initialize Whisper, falling back to Mock STT');
        const errorMsg = error instanceof Error ? error.message : String(error);
        appStatus.setDegraded('stt', `Whisper initialization failed: ${errorMsg}`);
      }
    }
  }
  
  console.log('🎙️  Using Mock STT provider (set USE_WHISPER_STT=true and configure OPENAI_API_KEY to enable Whisper)');
};

// Initialize STT provider asynchronously - never crash on failure
initializeSttProvider().catch(error => {
  console.error('⚠️  STT provider initialization failed, continuing with degraded service:', error);
  // Server continues despite STT failure - this is intentional for "unsinkable mode"
});

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

// CSRF token endpoint (public, no auth required)
app.get('/api/csrf-token', generateCsrfToken, (req, res) => {
  res.json({
    success: true,
    csrfToken: res.locals.csrfToken,
  });
});

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
  // Import config status and app status dynamically to avoid circular dependencies
  const { depotTranscriptionService } = await import('./services/depotTranscription.service');
  const { appStatus } = await import('./core/appStatus');
  const configStatus = depotTranscriptionService.getConfigLoadStatus();
  
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
    coreConfig: {
      depotSchemaLoadedFrom: configStatus.depotSchema.loadedFrom || 'fallback',
      depotSchemaUsedFallback: configStatus.depotSchema.usedFallback,
      checklistConfigLoadedFrom: configStatus.checklistConfig.loadedFrom || 'fallback',
      checklistConfigUsedFallback: configStatus.checklistConfig.usedFallback,
    },
    database: 'unknown',
    degraded: appStatus.degraded,
    degradedNotes: appStatus.getNotes(),
  };

  try {
    await db.select().from(users).limit(1);
    health.database = 'connected';
  } catch {
    health.database = 'disconnected';
    health.status = 'degraded';
  }

  // Mark as degraded if any subsystem is degraded
  if (appStatus.hasAnyDegraded()) {
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
app.use('/api/nas', nasRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/leads', leadWorkspaceRouter); // Workspace routes (/:id/workspace, etc.)
app.use('/api/leads', systemRecommendationsRouter); // System recommendation routes (/:id/system-recommendation, etc.)
app.use('/api/appointments', appointmentsRouter);
app.use('/api/visit-sessions', visitSessionsRouter);
app.use('/api/files', filesRouter);
app.use('/api/transcription', transcriptionRouter);
app.use('/api/depot-notes', depotNotesRouter);
app.use('/api/survey-helper', surveyHelperRouter);
app.use('/api/voice-notes', voiceNotesRouter); // Rocky & Sarah architecture
app.use('/api/rocky', rockyRouter); // Rocky standalone endpoint
app.use('/api/sarah', sarahRouter); // Sarah standalone endpoint
app.use('/api/voice', voiceTransformRouter); // Voice transform endpoint
app.use('/api/knowledge', knowledgeRouter); // Knowledge ingest system
app.use('/api/ai', aiRouter); // AI Gateway (server-side proxy to Cloudflare Worker)
app.use('/api/session', sessionRouter); // Session management (active lead persistence)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// CSRF error handler (before general error handler)
app.use(csrfErrorHandler);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Print startup summary
const printStartupSummary = async () => {
  const { appStatus } = await import('./core/appStatus');
  const { depotTranscriptionService } = await import('./services/depotTranscription.service');
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 STARTUP SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`🔢 Version: ${process.env.npm_package_version || API_VERSION}`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`📍 Host: ${HOST}`);
  console.log(`🔧 Node: ${process.version}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  
  // Config status
  const configStatus = depotTranscriptionService.getConfigLoadStatus();
  console.log('📋 Configuration:');
  console.log(`   Depot Schema: ${configStatus.depotSchema.loadedFrom || 'fallback'}${configStatus.depotSchema.usedFallback ? ' (fallback)' : ''}`);
  console.log(`   Checklist Config: ${configStatus.checklistConfig.loadedFrom || 'fallback'}${configStatus.checklistConfig.usedFallback ? ' (fallback)' : ''}`);
  console.log('');
  
  // Database status
  let dbOk = false;
  try {
    await db.select().from(users).limit(1);
    dbOk = true;
    console.log('🗄️  Database: ✅ Connected');
  } catch (error) {
    console.log('🗄️  Database: ❌ Disconnected');
    appStatus.setDegraded('database', 'Database connection failed at startup');
  }
  console.log('');
  
  // Degraded subsystems
  if (appStatus.hasAnyDegraded()) {
    console.log('⚠️  DEGRADED SUBSYSTEMS:');
    const degradedList = appStatus.getAllDegraded();
    degradedList.forEach(key => {
      console.log(`   ❌ ${key}`);
    });
    console.log('');
    console.log('📝 Degradation Notes:');
    appStatus.getNotes().forEach(note => {
      console.log(`   ${note}`);
    });
    console.log('');
  } else {
    console.log('✅ All subsystems operational');
    console.log('');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
};

// Start server
app.listen(PORT, HOST, async () => {
  // Print startup summary first
  await printStartupSummary();
  
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
  console.log(`   /api/knowledge (PDF upload, search, citations)`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

export default app;
