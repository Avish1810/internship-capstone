// src/middleware/validate.js
"use strict";

const { validationResult } = require("express-validator");

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: {
        code: 422,
        message: "Validation failed",
        fields: errors.array().map((e) => ({
          field:   e.path,
          message: e.msg,
          value:   e.value,
        })),
      },
    });
  }
  next();
};
