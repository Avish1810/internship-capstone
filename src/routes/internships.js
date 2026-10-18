// src/routes/internships.js
"use strict";

const express  = require("express");
const { body, query, param } = require("express-validator");
const router   = express.Router();
const db       = require("../db");
const validate = require("../middleware/validate");
const logger   = require("../logger");

const MODES = ["Remote", "Hybrid", "On-site"];

function parseRow(row) {
  if (!row) return null;
  try { row.skills = JSON.parse(row.skills || "[]"); } catch { row.skills = []; }
  row.applications_open = Boolean(row.applications_open);
  return row;
}

function genId() {
  let id, tries = 0;
  do { id = `INT-${Math.floor(Math.random() * 90000) + 10000}`; tries++; }
  while (db.prepare("SELECT 1 FROM internships WHERE id=?").get(id) && tries < 10);
  return id;
}

// ── GET /api/internships ─────────────────────
router.get("/",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("page must be >= 1"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100"),
    query("domain").optional().isString().trim(),
    query("mode").optional().isIn([...MODES, ""]).withMessage(`mode must be one of: ${MODES.join(", ")}`),
    query("open").optional().isIn(["true", "false", "1", "0"]).withMessage("open must be a boolean flag"),
    query("search").optional().isString().trim(),
    query("sort").optional().isIn(["newest", "oldest", "stipend_high", "stipend_low", "duration_short", "duration_long"]),
  ],
  validate,
  (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page  || "1",  10));
    const limit  = Math.min(100, parseInt(req.query.limit || "12", 10));
    const offset = (page - 1) * limit;

    const conds = [], params = [];

    if (req.query.domain && req.query.domain !== "All") {
      conds.push("LOWER(domain) LIKE ?");
      params.push(`%${req.query.domain.toLowerCase()}%`);
    }
    if (req.query.mode) {
      conds.push("mode = ?");
      params.push(req.query.mode);
    }
    if (req.query.open !== undefined) {
      conds.push("applications_open = ?");
      params.push(req.query.open === "true" || req.query.open === "1" ? 1 : 0);
    }
    if (req.query.search) {
      conds.push("(LOWER(title) LIKE ? OR LOWER(domain) LIKE ? OR LOWER(location) LIKE ?)");
      const s = `%${req.query.search.toLowerCase()}%`;
      params.push(s, s, s);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    let orderBy = "created_at DESC";
    if (req.query.sort === "oldest") orderBy = "created_at ASC";
    else if (req.query.sort === "stipend_high") orderBy = "COALESCE(stipend_monthly, 0) DESC";
    else if (req.query.sort === "stipend_low") orderBy = "COALESCE(stipend_monthly, 0) ASC";
    else if (req.query.sort === "duration_short") orderBy = "duration_weeks ASC";
    else if (req.query.sort === "duration_long") orderBy = "duration_weeks DESC";

    const total = db.prepare(`SELECT COUNT(*) AS n FROM internships ${where}`).get(...params).n;
    const rows  = db.prepare(`SELECT * FROM internships ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const totalPages = Math.ceil(total / limit) || 1;

    res.json({
      success: true,
      data: rows.map(parseRow),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  }
);

// ── GET /api/internships/meta ────────────────
router.get("/meta", (req, res) => {
  const domains = db.prepare("SELECT DISTINCT domain FROM internships ORDER BY domain").all().map(r => r.domain);
  const modes   = db.prepare("SELECT DISTINCT mode FROM internships ORDER BY mode").all().map(r => r.mode);
  const totalCount = db.prepare("SELECT COUNT(*) AS n FROM internships").get().n;
  res.json({ success: true, data: { domains, modes, totalCount } });
});

// ── GET /api/internships/:id ─────────────────
router.get("/:id", [param("id").notEmpty()], validate, (req, res) => {
  const row = db.prepare("SELECT * FROM internships WHERE id=?").get(req.params.id);
  if (!row) {
    return res.status(404).json({
      success: false,
      error: { code: 404, message: `Internship '${req.params.id}' not found` },
    });
  }
  res.json({ success: true, data: parseRow(row) });
});

// ── Validation body rules ────────────────────
const bodyRules = [
  body("title").trim().notEmpty().withMessage("title is required").isLength({ max: 200 }),
  body("domain").trim().notEmpty().withMessage("domain is required").isLength({ max: 100 }),
  body("mode").isIn(MODES).withMessage(`mode must be one of: ${MODES.join(", ")}`),
  body("location").optional().trim().isLength({ max: 100 }),
  body("duration_weeks").isInt({ min: 1, max: 104 }).withMessage("duration_weeks must be 1–104"),
  body("openings").optional().isInt({ min: 0 }),
  body("stipend_monthly").optional({ nullable: true }).isInt({ min: 0 }),
  body("skills").optional().isArray(),
  body("applications_open").optional().isBoolean(),
];

// ── POST /api/internships ────────────────────
router.post("/", bodyRules, validate, (req, res) => {
  const { title, domain, mode, location = "India", duration_weeks, openings = 1, stipend_monthly = null, skills = [], applications_open = true } = req.body;
  const id = genId();

  db.prepare(`
    INSERT INTO internships (id, title, domain, mode, location, duration_weeks, openings, stipend_monthly, skills, applications_open)
    VALUES (@id, @title, @domain, @mode, @location, @duration_weeks, @openings, @stipend_monthly, @skills, @applications_open)
  `).run({
    id, title, domain, mode, location,
    duration_weeks: +duration_weeks,
    openings: +openings,
    stipend_monthly: stipend_monthly !== null ? +stipend_monthly : null,
    skills: JSON.stringify(skills),
    applications_open: applications_open ? 1 : 0,
  });

  logger.info("Internship created", { id, title });
  res.status(201).json({ success: true, data: parseRow(db.prepare("SELECT * FROM internships WHERE id=?").get(id)) });
});

// ── PUT /api/internships/:id ─────────────────
router.put("/:id", [param("id").notEmpty(), ...bodyRules], validate, (req, res) => {
  if (!db.prepare("SELECT 1 FROM internships WHERE id=?").get(req.params.id)) {
    return res.status(404).json({ success: false, error: { code: 404, message: `Internship '${req.params.id}' not found` } });
  }

  const { title, domain, mode, location = "India", duration_weeks, openings = 1, stipend_monthly = null, skills = [], applications_open = true } = req.body;
  db.prepare(`
    UPDATE internships
    SET title=@title, domain=@domain, mode=@mode, location=@location,
        duration_weeks=@duration_weeks, openings=@openings,
        stipend_monthly=@stipend_monthly, skills=@skills,
        applications_open=@applications_open,
        updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')
    WHERE id=@id
  `).run({
    id: req.params.id, title, domain, mode, location,
    duration_weeks: +duration_weeks, openings: +openings,
    stipend_monthly: stipend_monthly !== null ? +stipend_monthly : null,
    skills: JSON.stringify(skills), applications_open: applications_open ? 1 : 0,
  });

  logger.info("Internship updated (PUT)", { id: req.params.id });
  res.json({ success: true, data: parseRow(db.prepare("SELECT * FROM internships WHERE id=?").get(req.params.id)) });
});

// ── PATCH /api/internships/:id ───────────────
router.patch("/:id", [
  param("id").notEmpty(),
  body("title").optional().trim().notEmpty().isLength({ max: 200 }),
  body("domain").optional().trim().notEmpty().isLength({ max: 100 }),
  body("mode").optional().isIn(MODES),
  body("location").optional().trim().isLength({ max: 100 }),
  body("duration_weeks").optional().isInt({ min: 1, max: 104 }),
  body("openings").optional().isInt({ min: 0 }),
  body("stipend_monthly").optional({ nullable: true }).isInt({ min: 0 }),
  body("skills").optional().isArray(),
  body("applications_open").optional().isBoolean(),
], validate, (req, res) => {
  if (!db.prepare("SELECT 1 FROM internships WHERE id=?").get(req.params.id)) {
    return res.status(404).json({ success: false, error: { code: 404, message: `Internship '${req.params.id}' not found` } });
  }

  const allowed = ["title","domain","mode","location","duration_weeks","openings","stipend_monthly","skills","applications_open"];
  const sets = [], vals = {};
  for (const f of allowed) {
    if (req.body[f] !== undefined) {
      sets.push(`${f}=@${f}`);
      vals[f] = f === "skills" ? JSON.stringify(req.body[f]) : f === "applications_open" ? (req.body[f] ? 1 : 0) : req.body[f];
    }
  }
  if (!sets.length) return res.status(400).json({ success: false, error: { code: 400, message: "No valid fields to update" } });

  sets.push("updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')");
  vals.id = req.params.id;
  db.prepare(`UPDATE internships SET ${sets.join(",")} WHERE id=@id`).run(vals);

  logger.info("Internship patched", { id: req.params.id, fields: Object.keys(vals) });
  res.json({ success: true, data: parseRow(db.prepare("SELECT * FROM internships WHERE id=?").get(req.params.id)) });
});

// ── DELETE /api/internships/:id ──────────────
router.delete("/:id", [param("id").notEmpty()], validate, (req, res) => {
  if (!db.prepare("SELECT 1 FROM internships WHERE id=?").get(req.params.id)) {
    return res.status(404).json({ success: false, error: { code: 404, message: `Internship '${req.params.id}' not found` } });
  }
  db.prepare("DELETE FROM internships WHERE id=?").run(req.params.id);
  logger.info("Internship deleted", { id: req.params.id });
  res.json({ success: true, message: `Internship '${req.params.id}' deleted` });
});

module.exports = router;
