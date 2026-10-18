// tests/api.test.js – Full Capstone Integration and Regression Suite
"use strict";

const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
const app = require("../server");
const TEST_PORT = 3105;
let server;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, resolve);
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function api(path, options = {}) {
  const url = `http://localhost:${TEST_PORT}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body: json };
}

// ── 1. HEALTH AND BASE CHECKS ────────────────
describe("Health & System Status", () => {
  test("GET /health reports status, memory, uptime, and database", async () => {
    const { status, body } = await api("/health");
    assert.equal(status, 200);
    assert.equal(body.status, "healthy");
    assert.ok(body.database?.connected);
    assert.ok(typeof body.uptime_seconds === "number");
    assert.ok(body.memory?.heap_used_mb);
  });

  test("GET /api returns application metadata and docs map", async () => {
    const { status, body } = await api("/api");
    assert.equal(status, 200);
    assert.equal(body.status, "operational");
    assert.ok(body.docs.internships);
  });
});

// ── 2. INTERNSHIPS LIST & FILTERING ──────────
describe("GET /api/internships", () => {
  test("returns paginated array of listings", async () => {
    const { status, body } = await api("/api/internships");
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.pagination.total > 0);
  });

  test("supports pagination limits", async () => {
    const { status, body } = await api("/api/internships?page=1&limit=4");
    assert.equal(status, 200);
    assert.equal(body.data.length, 4);
    assert.equal(body.pagination.limit, 4);
    assert.equal(body.pagination.page, 1);
  });

  test("filters by mode (Remote)", async () => {
    const { status, body } = await api("/api/internships?mode=Remote");
    assert.equal(status, 200);
    for (const item of body.data) {
      assert.equal(item.mode, "Remote");
    }
  });

  test("filters by domain case-insensitively", async () => {
    const { status, body } = await api("/api/internships?domain=web");
    assert.equal(status, 200);
    for (const item of body.data) {
      assert.ok(item.domain.toLowerCase().includes("web"));
    }
  });

  test("supports stipend sorting (high to low)", async () => {
    const { status, body } = await api("/api/internships?sort=stipend_high&limit=5");
    assert.equal(status, 200);
    for (let i = 0; i < body.data.length - 1; i++) {
      const current = body.data[i].stipend_monthly || 0;
      const next    = body.data[i + 1].stipend_monthly || 0;
      assert.ok(current >= next, "expected descending stipend values");
    }
  });

  test("GET /api/internships/meta delivers distinct domain list", async () => {
    const { status, body } = await api("/api/internships/meta");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.data.domains));
    assert.ok(Array.isArray(body.data.modes));
    assert.ok(body.data.totalCount > 0);
  });
});

// ── 3. INTERNSHIPS CRUD LIFECYCLE ────────────
describe("Internships CRUD Lifecycle", () => {
  let createdId;

  test("POST /api/internships creates a listing", async () => {
    const newRecord = {
      title: "QA Automation Intern",
      domain: "Quality Assurance",
      mode: "Remote",
      duration_weeks: 6,
      openings: 2,
      stipend_monthly: 11000,
      skills: ["Playwright", "JavaScript", "Jest"],
      applications_open: true,
    };

    const { status, body } = await api("/api/internships", { method: "POST", body: newRecord });
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.title, newRecord.title);
    assert.ok(body.data.id.startsWith("INT-"));
    createdId = body.data.id;
  });

  test("GET /api/internships/:id returns created record", async () => {
    const { status, body } = await api(`/api/internships/${createdId}`);
    assert.equal(status, 200);
    assert.equal(body.data.id, createdId);
    assert.equal(body.data.title, "QA Automation Intern");
  });

  test("PATCH /api/internships/:id updates selected properties", async () => {
    const { status, body } = await api(`/api/internships/${createdId}`, {
      method: "PATCH",
      body: { stipend_monthly: 14000, openings: 4 },
    });
    assert.equal(status, 200);
    assert.equal(body.data.stipend_monthly, 14000);
    assert.equal(body.data.openings, 4);
    assert.equal(body.data.title, "QA Automation Intern");
  });

  test("DELETE /api/internships/:id removes the record", async () => {
    const { status, body } = await api(`/api/internships/${createdId}`, { method: "DELETE" });
    assert.equal(status, 200);
    assert.ok(body.message.includes("deleted"));

    const verify = await api(`/api/internships/${createdId}`);
    assert.equal(verify.status, 404);
  });
});

// ── 4. APPLICATIONS SECURITY & VALIDATION ───
describe("Applications Processing", () => {
  const testEmail = `capstone.applicant.${Date.now()}@example.com`;
  const validApp = {
    internship_id:   "INT-101",
    applicant_name:  "Rohan Verma",
    applicant_email: testEmail,
    phone:           "+91 98765 12345",
    portfolio_url:   "https://github.com/rohan-verma",
    cover_letter:    "I have built full-stack applications with Node.js and React and am enthusiastic about joining as an intern.",
  };

  test("POST /api/applications records a valid candidate", async () => {
    const { status, body } = await api("/api/applications", { method: "POST", body: validApp });
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.applicant_email, testEmail);
  });

  test("blocks duplicate application for same role with 409", async () => {
    const { status, body } = await api("/api/applications", { method: "POST", body: validApp });
    assert.equal(status, 409);
    assert.ok(body.error.message.toLowerCase().includes("already applied"));
  });

  test("rejects invalid input with structured 422 errors", async () => {
    const { status, body } = await api("/api/applications", {
      method: "POST",
      body: {
        internship_id:   "INT-101",
        applicant_name:  "1234!!", // invalid name format
        applicant_email: "not-an-email",
        cover_letter:    "Short", // < 30 chars
      },
    });
    assert.equal(status, 422);
    assert.ok(Array.isArray(body.error.fields));
    const fields = body.error.fields.map(f => f.field);
    assert.ok(fields.includes("applicant_name"));
    assert.ok(fields.includes("applicant_email"));
    assert.ok(fields.includes("cover_letter"));
  });

  test("rejects application to closed internship (INT-004) with 409", async () => {
    const { status, body } = await api("/api/applications", {
      method: "POST",
      body: {
        ...validApp,
        internship_id:   "INT-004",
        applicant_email: `unique.${Date.now()}@example.com`,
      },
    });
    assert.equal(status, 409);
    assert.ok(body.error.message.toLowerCase().includes("closed"));
  });
});

// ── 5. SECURITY HEADERS & PROTOCOLS ──────────
describe("Security Headers (Helmet)", () => {
  test("enforces security headers on responses", async () => {
    const { headers } = await api("/api/internships");
    assert.equal(headers.get("x-content-type-options"), "nosniff");
    assert.ok(headers.get("x-frame-options"));
    assert.ok(headers.get("content-security-policy"));
  });
});
