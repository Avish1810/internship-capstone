// src/routes/health.js
"use strict";

const express = require("express");
const router  = express.Router();
const db      = require("../db");
const config  = require("../config");

router.get("/", (req, res) => {
  const dbStatus = db.healthCheck();
  const memory   = process.memoryUsage();
  
  const healthData = {
    status:    dbStatus.connected ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    version:   config.VERSION,
    environment: config.NODE_ENV,
    database:  dbStatus,
    memory: {
      rss_mb:        Math.round(memory.rss / 1024 / 1024 * 100) / 100,
      heap_used_mb:  Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
      heap_total_mb: Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100,
    },
  };

  const statusCode = dbStatus.connected ? 200 : 503;
  res.status(statusCode).json(healthData);
});

module.exports = router;
