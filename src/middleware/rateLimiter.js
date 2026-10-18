// src/middleware/rateLimiter.js
"use strict";

const rateLimit = require("express-rate-limit");
const config    = require("../config");

const apiLimiter = rateLimit({
  windowMs:         config.RATE_LIMIT_WINDOW_MS,
  max:              config.NODE_ENV === "test" ? 1000 : config.RATE_LIMIT_API_MAX,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    error: { code: 429, message: "Too many requests. Please try again later." },
  },
});

const applyLimiter = rateLimit({
  windowMs:         config.RATE_LIMIT_WINDOW_MS,
  max:              config.RATE_LIMIT_APPLY_MAX,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    error: { code: 429, message: "Too many applications submitted from this IP. Please wait 15 minutes." },
  },
});

module.exports = { apiLimiter, applyLimiter };
