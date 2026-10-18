// ─────────────────────────────────────────────
//  src/logger.js  –  Structured JSON logger
//  • Levels: error, warn, info, debug
//  • JSON in production, pretty in development
//  • Includes timestamp, level, message, meta
// ─────────────────────────────────────────────
"use strict";

const { NODE_ENV, LOG_LEVEL, APP_NAME, VERSION } = require("./config");
const IS_PROD = NODE_ENV === "production";
const IS_TEST = NODE_ENV === "test";

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS = { error: "\x1b[31m", warn: "\x1b[33m", info: "\x1b[36m", debug: "\x1b[90m", reset: "\x1b[0m" };

const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

function log(level, message, meta = {}) {
  if (IS_TEST) return; // silent in tests
  if (LEVELS[level] > currentLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    app: APP_NAME,
    version: VERSION,
    message,
    ...meta,
  };

  if (IS_PROD) {
    process.stdout.write(JSON.stringify(entry) + "\n");
  } else {
    const color = COLORS[level] || "";
    const ts    = entry.timestamp.slice(11, 23); // HH:MM:SS.mmm
    const metaStr = Object.keys(meta).length
      ? " " + Object.entries(meta).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(" ")
      : "";
    console.log(`${color}[${ts}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}${COLORS.reset}`);
  }
}

const logger = {
  error: (msg, meta) => log("error", msg, meta),
  warn:  (msg, meta) => log("warn",  msg, meta),
  info:  (msg, meta) => log("info",  msg, meta),
  debug: (msg, meta) => log("debug", msg, meta),

  // Morgan stream integration
  stream: { write: (msg) => log("info", msg.trim(), { source: "http" }) },
};

module.exports = logger;
