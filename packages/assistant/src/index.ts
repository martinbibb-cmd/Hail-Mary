/**
 * Hail-Mary Assistant Service
 *
 * Main entry point for the assistant API.
 * Handles STT, message processing, and observation logging.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Import routes
import sttRouter from "./routes/stt";
import assistantRouter from "./routes/assistant";

const app = express();
const PORT = Number(process.env.ASSISTANT_PORT) || 3002;
const HOST = process.env.HOST || '0.0.0.0';

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for voice interactions
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later." },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Larger limit for audio data
app.use("/", limiter);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ 
    status: "ok", 
    service: "assistant",
    timestamp: new Date().toISOString() 
  });
});

// API Routes
app.use("/stt", sttRouter);
app.use("/assistant", assistantRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🤖 Hail-Mary Assistant running on http://${HOST}:${PORT}`);
  console.log(`   Health check: http://${HOST}:${PORT}/health`);
  console.log(`   API endpoints:`);
  console.log(`   - POST /stt`);
  console.log(`   - POST /assistant/message`);
});

export default app;
