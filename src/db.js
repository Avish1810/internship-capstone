// ─────────────────────────────────────────────
//  src/db.js  –  SQLite database
//  Includes: schema, seed data, health check
// ─────────────────────────────────────────────
"use strict";

const Database = require("better-sqlite3");
const fs       = require("fs");
const path     = require("path");
const { DB_PATH } = require("./config");
const logger       = require("./logger");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ───────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS internships (
    id                TEXT    PRIMARY KEY,
    title             TEXT    NOT NULL,
    domain            TEXT    NOT NULL,
    mode              TEXT    NOT NULL CHECK(mode IN ('Remote','Hybrid','On-site')),
    location          TEXT    NOT NULL DEFAULT 'India',
    duration_weeks    INTEGER NOT NULL CHECK(duration_weeks > 0),
    openings          INTEGER NOT NULL DEFAULT 1  CHECK(openings >= 0),
    stipend_monthly   INTEGER,
    skills            TEXT    NOT NULL DEFAULT '[]',
    applications_open INTEGER NOT NULL DEFAULT 1  CHECK(applications_open IN (0,1)),
    created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    internship_id    TEXT    NOT NULL,
    applicant_name   TEXT    NOT NULL,
    applicant_email  TEXT    NOT NULL,
    phone            TEXT,
    portfolio_url    TEXT,
    cover_letter     TEXT    NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('pending','reviewed','accepted','rejected')),
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE (internship_id, applicant_email),
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_internships_domain ON internships(domain);
  CREATE INDEX IF NOT EXISTS idx_internships_mode   ON internships(mode);
  CREATE INDEX IF NOT EXISTS idx_applications_iid   ON applications(internship_id);
`);

// ── Seed data ────────────────────────────────
const count = db.prepare("SELECT COUNT(*) AS n FROM internships").get().n;
if (count === 0) {
  logger.info("Seeding database with sample internship records");
  const ins = db.prepare(`
    INSERT OR IGNORE INTO internships
      (id,title,domain,mode,location,duration_weeks,openings,stipend_monthly,skills,applications_open)
    VALUES (@id,@title,@domain,@mode,@location,@duration_weeks,@openings,@stipend_monthly,@skills,@applications_open)
  `);
  db.transaction((rows) => rows.forEach((r) => ins.run(r)))([
    { id:"INT-001", title:"Frontend Practice Internship",  domain:"Web Development",       mode:"Remote",  location:"India",     duration_weeks:4,  openings:3, stipend_monthly:8000,  skills:JSON.stringify(["HTML","CSS","JavaScript"]),               applications_open:1 },
    { id:"INT-002", title:"Data Dashboard Internship",     domain:"Data Analytics",         mode:"Remote",  location:"India",     duration_weeks:6,  openings:2, stipend_monthly:10000, skills:JSON.stringify(["Excel","SQL","Data Visualisation"]),      applications_open:1 },
    { id:"INT-003", title:"Product Design Internship",     domain:"UI/UX",                  mode:"Hybrid",  location:"Bengaluru", duration_weeks:4,  openings:1, stipend_monthly:9000,  skills:JSON.stringify(["Figma","Research","Accessibility"]),       applications_open:1 },
    { id:"INT-004", title:"C++ Utility Internship",        domain:"C++ Programming",        mode:"Remote",  location:"India",     duration_weeks:5,  openings:0, stipend_monthly:null,  skills:JSON.stringify(["C++","Algorithms","OOP"]),                 applications_open:0 },
    { id:"INT-101", title:"Frontend Intern",               domain:"Full Stack Development", mode:"Remote",  location:"India",     duration_weeks:8,  openings:3, stipend_monthly:15000, skills:JSON.stringify(["HTML","CSS","JavaScript","React"]),        applications_open:1 },
    { id:"INT-102", title:"API Engineering Intern",        domain:"Full Stack Development", mode:"Hybrid",  location:"Pune",      duration_weeks:10, openings:2, stipend_monthly:18000, skills:JSON.stringify(["Node.js","SQL","Testing","REST APIs"]),    applications_open:1 },
    { id:"INT-103", title:"UI/UX Intern",                  domain:"UI/UX",                  mode:"Remote",  location:"India",     duration_weeks:6,  openings:1, stipend_monthly:10000, skills:JSON.stringify(["Figma","Prototyping","User Research"]),    applications_open:1 },
    { id:"INT-104", title:"Data Analyst Intern",           domain:"Data Analytics",         mode:"On-site", location:"Bengaluru", duration_weeks:8,  openings:2, stipend_monthly:12000, skills:JSON.stringify(["Excel","SQL","Tableau","Python"]),         applications_open:1 },
    { id:"INT-105", title:"Security Operations Intern",    domain:"Cyber Security",         mode:"Remote",  location:"India",     duration_weeks:12, openings:1, stipend_monthly:14000, skills:JSON.stringify(["Linux","Networking","Logs","SIEM"]),       applications_open:1 },
    { id:"INT-106", title:"Cloud Infrastructure Intern",   domain:"Cloud & DevOps",         mode:"Remote",  location:"India",     duration_weeks:10, openings:2, stipend_monthly:16000, skills:JSON.stringify(["AWS","Docker","Terraform","CI/CD"]),       applications_open:1 },
    { id:"INT-107", title:"Mobile App Intern",             domain:"Mobile Development",     mode:"Hybrid",  location:"Mumbai",    duration_weeks:8,  openings:2, stipend_monthly:13000, skills:JSON.stringify(["Flutter","Dart","Firebase","REST APIs"]),  applications_open:1 },
    { id:"INT-108", title:"Content Strategy Intern",       domain:"Marketing & Content",    mode:"Remote",  location:"India",     duration_weeks:6,  openings:3, stipend_monthly:6000,  skills:JSON.stringify(["SEO","Copywriting","Analytics","CMS"]),    applications_open:1 },
  ]);
  logger.info("Database seeded", { count: 12 });
}

// ── Health check ─────────────────────────────
db.healthCheck = function () {
  try {
    const row = db.prepare("SELECT COUNT(*) AS n FROM internships").get();
    return { connected: true, internship_count: row.n };
  } catch (e) {
    return { connected: false, error: e.message };
  }
};

module.exports = db;
