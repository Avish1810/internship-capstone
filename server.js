// server.js – Production Ready Internship Portal Entry
"use strict";

const express      = require("express");
const helmet       = require("helmet");
const cors         = require("cors");
const compression  = require("compression");
const morgan       = require("morgan");
const path         = require("path");
const config       = require("./src/config");
const logger       = require("./src/logger");
const db           = require("./src/db");
const { apiLimiter, applyLimiter } = require("./src/middleware/rateLimiter");
const errorHandler = require("./src/middleware/errorHandler");

const app = express();

// ── Compression (gzip) ───────────────────────
app.use(compression());

// ── HTTP Request Logging ─────────────────────
if (config.NODE_ENV !== "test") {
  app.use(morgan(config.NODE_ENV === "production" ? "combined" : "dev", { stream: logger.stream }));
}

// ── Security Headers (Helmet) ────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ─────────────────────────────────────
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));

// ── Body Parsers ─────────────────────────────
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false }));

// ── Static Frontend ──────────────────────────
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: config.NODE_ENV === "production" ? "1d" : 0,
}));

// ── Health Check ─────────────────────────────
app.use("/health", require("./src/routes/health"));

// ── Rate Limiting ────────────────────────────
app.use("/api", apiLimiter);
app.use("/api/applications", applyLimiter);

// ── API Routes ───────────────────────────────
app.use("/api/internships",  require("./src/routes/internships"));
app.use("/api/applications", require("./src/routes/applications"));

// ── Base API Info ────────────────────────────
app.get("/api", (req, res) => {
  res.json({
    name: config.APP_NAME,
    version: config.VERSION,
    status: "operational",
    docs: {
      internships:  "/api/internships",
      meta:         "/api/internships/meta",
      applications: "/api/applications",
      health:       "/health",
    },
  });
});

// ── SPA Fallback ─────────────────────────────
app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/health")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── 404 handler for unmatched API routes ─────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 404, message: `Cannot ${req.method} ${req.originalUrl}` },
  });
});

// ── Centralized Error Handler ────────────────
app.use(errorHandler);

// ── Graceful Shutdown & Bootstrap ────────────
let server;
if (require.main === module) {
  server = app.listen(config.PORT, () => {
    logger.info(`Server started on port ${config.PORT}`, {
      env: config.NODE_ENV,
      port: config.PORT,
      pid: process.pid,
    });
  });

  const shutdown = (signal) => {
    logger.warn(`Received ${signal}. Shutting down gracefully...`);
    if (server) {
      server.close(() => {
        logger.info("Closed out remaining connections.");
        try {
          db.close();
          logger.info("SQLite database connection closed.");
        } catch (e) {
          logger.error("Error closing database", { error: e.message });
        }
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = app;
