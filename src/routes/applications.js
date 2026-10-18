// src/routes/applications.js
"use strict";

const express  = require("express");
const { body, query } = require("express-validator");
const router   = express.Router();
const db       = require("../db");
const validate = require("../middleware/validate");
const logger   = require("../logger");

// ── POST /api/applications ───────────────────
router.post("/",
  [
    body("internship_id")
      .trim().notEmpty().withMessage("internship_id is required"),

    body("applicant_name")
      .trim().notEmpty().withMessage("Full name is required")
      .isLength({ min: 2, max: 150 }).withMessage("Name must be between 2 and 150 characters")
      .matches(/^[a-zA-Z\s.\-']+$/).withMessage("Name may only contain letters, spaces, and . - '"),

    body("applicant_email")
      .trim().notEmpty().withMessage("Email address is required")
      .isEmail().withMessage("Please enter a valid email address")
      .normalizeEmail(),

    body("phone")
      .optional({ checkFalsy: true })
      .matches(/^[+]?[\d\s\-().]{7,20}$/).withMessage("Please enter a valid phone number (7-20 digits/symbols)"),

    body("portfolio_url")
      .optional({ checkFalsy: true })
      .isURL({ protocols: ["http", "https"], require_protocol: true })
      .withMessage("Portfolio URL must start with http:// or https://"),

    body("cover_letter")
      .trim().notEmpty().withMessage("Cover letter is required")
      .isLength({ min: 30, max: 2000 }).withMessage("Cover letter must be 30–2000 characters"),
  ],
  validate,
  (req, res) => {
    const { internship_id, applicant_name, applicant_email, phone = "", portfolio_url = "", cover_letter } = req.body;

    // 1. Verify internship exists
    const internship = db.prepare("SELECT id, title, applications_open FROM internships WHERE id=?").get(internship_id);
    if (!internship) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: `Internship '${internship_id}' not found` },
      });
    }

    // 2. Check if applications are open
    if (!internship.applications_open) {
      return res.status(409).json({
        success: false,
        error: { code: 409, message: `Applications for '${internship.title}' are currently closed` },
      });
    }

    // 3. Insert application (Enforce UNIQUE(internship_id, applicant_email))
    try {
      const result = db.prepare(`
        INSERT INTO applications (internship_id, applicant_name, applicant_email, phone, portfolio_url, cover_letter)
        VALUES (@internship_id, @applicant_name, @applicant_email, @phone, @portfolio_url, @cover_letter)
      `).run({ internship_id, applicant_name, applicant_email, phone, portfolio_url, cover_letter });

      const application = db.prepare("SELECT * FROM applications WHERE id=?").get(result.lastInsertRowid);
      logger.info("Application submitted successfully", {
        applicationId: application.id,
        internshipId: internship_id,
        email: applicant_email
      });
      return res.status(201).json({ success: true, data: application });

    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || err.message.includes("UNIQUE")) {
        logger.warn("Duplicate application rejected", { internship_id, applicant_email });
        return res.status(409).json({
          success: false,
          error: { code: 409, message: "You have already applied for this internship with this email address" },
        });
      }
      throw err;
    }
  }
);

// ── GET /api/applications ────────────────────
router.get("/",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("internship_id").optional().isString().trim(),
  ],
  validate,
  (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page  || "1",  10));
    const limit  = Math.min(100, parseInt(req.query.limit || "20", 10));
    const offset = (page - 1) * limit;

    const conds = [], params = [];
    if (req.query.internship_id) { conds.push("internship_id=?"); params.push(req.query.internship_id); }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const total = db.prepare(`SELECT COUNT(*) AS n FROM applications ${where}`).get(...params).n;
    const rows  = db.prepare(`SELECT * FROM applications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  }
);

module.exports = router;
