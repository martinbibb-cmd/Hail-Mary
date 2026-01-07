/**
 * Hail-Mary API Server
 * 
 * Main entry point for the backend API.
 */

import 'dotenv/config';
import express from 'express';
import type { Request, RequestHandler } from 'express';
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
import adminMediaRouter from './routes/adminMedia';
import nasRouter from './routes/nas';
import customersRouter from './routes/customers';
import productsRouter from './routes/products';
import quotesRouter from './routes/quotes';
import leadsRouter from './routes/leads';
import leadWorkspaceRouter from './routes/leadWorkspace';
import appointmentsRouter from './routes/appointments';
import visitSessionsRouter from './routes/visitSessions';
import filesRouter from './routes/files';
import assetsRouter from './routes/assets';
import transcriptionRouter from './routes/transcription';
import transcriptsRouter from './routes/transcripts';
import photosRouter from './routes/photos';
import scansRouter from './routes/scans';
import addressesRouter from './routes/addresses';
import addressAppointmentsRouter from './routes/addressAppointments';
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
import spineRouter from './routes/spine';
import uploadsRouter from './routes/uploads';
import ingestRouter from './routes/ingest';
import engineerRouter from './routes/engineer';
import customerSummaryRouter from './routes/customerSummary';
import presentationDraftsRouter from './routes/presentationDrafts';
import userSettingsRouter from './routes/userSettings';
import trajectoryRouter from './routes/trajectory';
import atlasRouter from './routes/atlas';
import gcRouter from './routes/gc';
import bugReportsRouter from './routes/bugReports';
import metaRouter from './routes/meta';
import jobGraphRouter from './routes/job-graph';
import heatingDesignRouter from './routes/heating-design';
import diagnosticsRouter from './routes/diagnostics';

import path from 'path';

// API version - kept in sync with package.json
export const API_VERSION = '0.2.0';

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const IS_DEV = (process.env.NODE_ENV || 'development') !== 'production';

// Local uploads (Option A)
// Served as: GET /uploads/<filename>
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

// Trust proxy - required when running behind nginx/Docker/Cloudflare
// This must be set before rate-limit middleware to prevent ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

// Initialize database (PostgreSQL via Drizzle ORM)
initializeDatabase();

// Seed trajectory assumptions (UK placeholder data)
import { seedUKAssumptions } from './db/seeds/trajectory-assumptions';
seedUKAssumptions().catch(err => {
  console.error('Failed to seed trajectory assumptions:', err);
});

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
// Split rate limiters by concern:
// - Auth is chatty in SPAs (/auth/me, /auth/config) and should almost never be blocked.
// - Rocky/Sarah/AI can be expensive and should be stricter.
// - Everything else gets a reasonable baseline.
const logLimiterHit = (name: string, req: Request) => {
  if (!IS_DEV) return;
  const xff = req.headers['x-forwarded-for'];
  const ua = req.headers['user-agent'];
  console.warn(
    `[rate-limit:${name}] ${req.method} ${req.originalUrl} ip=${req.ip}` +
      (xff ? ` xff=${String(xff)}` : '') +
      (ua ? ` ua=${String(ua)}` : '')
  );
};

/**
 * Wrap a rate limiter so we can log (dev-only) when it returns 429.
 * We avoid using express-rate-limit's `handler` option because the
 * legacy @types package used in this repo doesn't expose it.
 */
const wrapLimiter = (name: string, limiter: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);
    const origStatus = res.status.bind(res);
    let capturedStatus: number | undefined;

    res.status = ((code: number) => {
      capturedStatus = code;
      return origStatus(code);
    }) as any;

    res.json = ((body: any) => {
      const statusCode = capturedStatus ?? res.statusCode;
      if (statusCode === 429) logLimiterHit(name, req);
      return origJson(body);
    }) as any;

    res.send = ((body: any) => {
      const statusCode = capturedStatus ?? res.statusCode;
      if (statusCode === 429) logLimiterHit(name, req);
      return origSend(body);
    }) as any;

    return limiter(req, res, next);
  };
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // baseline for non-auth, non-AI endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  // Exclude chatty/critical and expensive endpoints from the baseline limiter.
  // These have their own dedicated limiters below.
  skip: (req) => {
    const p = req.path || '';
    return (
      p.startsWith('/auth') ||
      p === '/csrf-token' ||
      p.startsWith('/rocky') ||
      p.startsWith('/sarah') ||
      p.startsWith('/ai')
    );
  },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  // Don't punish successful logins/me checks.
  skipSuccessfulRequests: true,
  message: { success: false, code: 'rate_limited', error: 'Please wait a moment and try again.' },
  // /me and /config have their own (more generous) rules.
  skip: (req) => req.path === '/me' || req.path === '/config',
});

const authMeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, code: 'rate_limited', error: 'Please wait a moment and try again.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'rate_limited', error: 'Too many requests, please try again later.' },
});

const diagnosticsLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 10, // 10 requests per 10 seconds
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'rate_limited', error: 'Too many diagnostic requests, please wait a moment.' },
});

// CORS Configuration
// Allow requests from the PWA domain with credentials (cookies)
// If CORS_ORIGIN is not set, allow the default domains
const getAllowedOrigins = (): string[] | boolean => {
  if (process.env.CORS_ORIGIN) {
    // If explicitly set, use it (can be comma-separated list)
    if (process.env.CORS_ORIGIN === 'true' || process.env.CORS_ORIGIN === '*') {
      return true;
    }
    return process.env.CORS_ORIGIN.split(',').map(o => o.trim());
  }

  // Default allowed origins for typical deployment
  return [
    'https://atlas.cloudbibb.uk',
    'https://hail_mary.cloudbibb.uk',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
  ];
};

app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use('/api', wrapLimiter('api', apiLimiter)); // Baseline rate limiting for API routes

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
// Auth should not be blocked by Rocky/AI limits; it has its own generous limiter.
app.use('/api/auth/me', wrapLimiter('auth-me', authMeLimiter));
app.use('/api/auth', wrapLimiter('auth', authLimiter), authRouter);
// PR12: "admin media" is curated by admins but read by engineers; do NOT gate with requireAdmin.
// Mount before /api/admin to avoid adminRouter intercepting the path.
app.use('/api/admin/media', adminMediaRouter);
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
app.use('/api/photos', photosRouter); // PR14: postcode-based property photos
app.use('/api/scans', scansRouter); // PR15: postcode-based scan sessions (LiDAR placeholder)
app.use('/api/addresses', addressesRouter); // Address management with permissions
app.use('/api/address-appointments', addressAppointmentsRouter); // Address-based appointments with diary feed
app.use('/api', assetsRouter); // media receiver (assets + visit_events)
app.use('/api/transcription', transcriptionRouter);
app.use('/api', transcriptsRouter); // Option A live transcript ingestion
app.use('/api/depot-notes', depotNotesRouter);
app.use('/api/survey-helper', surveyHelperRouter);
app.use('/api/voice-notes', voiceNotesRouter); // Rocky & Sarah architecture
app.use('/api/rocky', wrapLimiter('ai', aiLimiter), rockyRouter); // Rocky standalone endpoint
app.use('/api/sarah', wrapLimiter('ai', aiLimiter), sarahRouter); // Sarah standalone endpoint
app.use('/api/voice', voiceTransformRouter); // Voice transform endpoint
app.use('/api/knowledge', knowledgeRouter); // Knowledge ingest system
app.use('/api/ai', wrapLimiter('ai', aiLimiter), aiRouter); // AI Gateway (server-side proxy to Cloudflare Worker)
app.use('/api/session', sessionRouter); // Session management (active lead persistence)
app.use('/api', spineRouter); // v2 Spine (all-activity feed + postcode-first properties)
app.use('/api', uploadsRouter); // local uploads helper for v2 spine camera
app.use('/api/ingest', ingestRouter); // Companion -> timeline ingest endpoints
app.use('/api/engineer', engineerRouter); // v2 Spine: manual Engineer runs -> timeline
app.use('/api/customer', customerSummaryRouter); // v2 Spine: customer-friendly summary from latest engineer_output
app.use('/api/presentation', presentationDraftsRouter); // PR12b: presentation drafts (customer packs)
app.use('/api/user-settings', userSettingsRouter); // User preferences and settings persistence
app.use('/api/trajectory', trajectoryRouter); // Trajectory Engine: carbon/cost projections for retrofit journeys
app.use('/api/atlas', atlasRouter); // Atlas Heat Loss API: room-by-room heat loss calculations following MCS 3005-D
app.use('/api/gc', gcRouter); // GC Boiler Catalog: truth layer for boiler facts, survey resolution, and enrichment
app.use('/api/bug-reports', bugReportsRouter); // Bug Reports: User-submitted bug reports and feature requests
app.use('/api/meta', metaRouter); // Meta: Build fingerprinting and system metadata
app.use('/api/job-graph', jobGraphRouter); // Job Graph: Orchestration spine for turning captured data into defensible outputs
app.use('/api/heating-design', heatingDesignRouter); // Heating Design: Floor plan import, heat loss calculations, radiator selection, pipe routing
app.use('/api/diagnostics', wrapLimiter('diagnostics', diagnosticsLimiter), diagnosticsRouter); // Diagnostics: Backend health, schema, and data presence monitoring (admin-only)

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
