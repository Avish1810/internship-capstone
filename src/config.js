// ─────────────────────────────────────────────
//  src/config.js  –  Centralized configuration
// ─────────────────────────────────────────────
"use strict";

module.exports = {
  PORT:      process.env.PORT      || 3003,
  NODE_ENV:  process.env.NODE_ENV  || "development",
  APP_NAME:  "InternBoard",
  VERSION:   "3.0.0",
  DB_PATH:   process.env.DB_PATH   || require("path").join(__dirname, "..", "data", "internships.db"),
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  // Rate limits
  RATE_LIMIT_WINDOW_MS:  15 * 60 * 1000,
  RATE_LIMIT_API_MAX:    100,
  RATE_LIMIT_APPLY_MAX:  process.env.NODE_ENV === "test" ? 1000 : 5,
};
