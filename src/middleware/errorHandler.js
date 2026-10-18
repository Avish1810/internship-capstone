// src/middleware/errorHandler.js
"use strict";
const logger = require("../logger");

module.exports = function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const isOp    = status < 500;                         // operational vs programmer error
  const message = (isOp || process.env.NODE_ENV !== "production")
    ? err.message
    : "An unexpected error occurred. Please try again.";

  if (!isOp) {
    logger.error("Unhandled server error", {
      status, message: err.message,
      url: req.originalUrl, method: req.method,
      stack: err.stack?.split("\n")[1]?.trim(),
    });
  }

  res.status(status).json({
    success: false,
    error: { code: status, message },
  });
};
