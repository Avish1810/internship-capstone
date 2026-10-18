# 🎓 InternBoard — Production-Ready Full-Stack Internship Portal
### Full Stack Development · Capstone Final Project

InternBoard is a production-grade, accessible full-stack internship portal built from scratch without bulky frontend or backend frameworks. It connects an interactive, mobile-optimized user interface to a hardened Node.js/Express REST API backed by SQLite persistence.

---

## 🌟 Highlights & Key Engineering Decisions

### 1. Robust Architecture & Operational Readiness
- **Zero-Framework Frontend**: Native modern JavaScript (ES6+), semantic HTML5, and responsive CSS with custom properties (`clamp()`, CSS Grid, Flexbox).
- **Hardened Express API**: Structured route controllers, centralized logging, strict input sanitization, and structured JSON responses.
- **SQLite with WAL Mode & Indexes**: Fast file-based relational storage using `better-sqlite3`. Indexes on `domain`, `mode`, and foreign keys ensure sub-millisecond query execution.
- **Automated Health Checks**: `/health` endpoint outputs database connectivity, system uptime, memory utilization (heap/RSS), and environment details.
- **Graceful Shutdown**: Intercepts `SIGINT` and `SIGTERM` to safely terminate active connections and cleanly close SQLite database handles.

### 2. Security & Defense-in-Depth
- **Helmet HTTP Headers**: Protects against cross-site scripting (XSS), clickjacking, and MIME sniffing (`CSP`, `X-Frame-Options: DENY`, `nosniff`).
- **Granular Rate Limiting**:
  - General API: `100 req / 15 min` per IP.
  - Application Submissions: `5 req / 15 min` per IP to stop spam.
- **100% Parameterized SQL Statements**: Eliminates SQL injection vectors.
- **Database Integrity Constraints**: `UNIQUE(internship_id, applicant_email)` and foreign key cascade rules stop duplicate entries at the database level.
- **Dual Validation Pipeline**: Client-side feedback before submission coupled with strict server-side schema verification via `express-validator` (returning standard `422 Unprocessable Entity` payloads).

### 3. User Experience & Accessibility (WCAG 2.1 AA)
- **Fluid Layouts**: Responsive from 320px mobile screens to large desktop monitors.
- **Full Keyboard Navigation**: Skip-to-content anchor, roving focus indicators, modal focus trap, and Escape key listeners.
- **Screen Reader Support**: ARIA live regions (`aria-live="polite"`), `aria-invalid` form states, and accessible table/group landmarks.
- **High Contrast & Reduced Motion**: Automatically honors `prefers-reduced-motion: reduce`.
- **States & Micro-interactions**: Shimmer skeleton loaders, empty filter states with a 1-click reset, and clear error recovery flows.

---

## 🛠️ System Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Production health check (DB, memory, uptime) |
| `GET` | `/api` | API directory and service discovery |
| `GET` | `/api/internships` | Paginated listing with search, domain, mode, and sort options |
| `GET` | `/api/internships/meta` | Unique metadata for filter pills and counts |
| `GET` | `/api/internships/:id` | Detailed individual internship record |
| `POST` | `/api/internships` | Create a new internship listing |
| `PUT` | `/api/internships/:id` | Full replacement update |
| `PATCH` | `/api/internships/:id` | Partial field update |
| `DELETE` | `/api/internships/:id` | Remove an internship listing |
| `POST` | `/api/applications` | Secure candidate application submission |
| `GET` | `/api/applications` | Paginated list of candidate applications |

---

## 🧪 Testing & Verification

Run the automated integration and regression suite:

```bash
npm test
```

**Results:**
- **17/17 tests passing** across 5 suites:
  - System health diagnostics and operational indicators
  - Listing filters (mode, domain, search, sort)
  - Full CRUD lifecycle (create, get, patch, delete)
  - Application submissions, unique email checks, and 422 error structures
  - Helmet security headers and HTTP compression verification

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite
npm test

# 3. Start the application
npm start

# Server launches at http://localhost:3003
# Web Portal: http://localhost:3003/
# Health Check: http://localhost:3003/health
```

---

## 📁 Project Structure

```
internship-capstone/
├── server.js                    # Express bootstrap, security middleware, static hosting
├── src/
│   ├── config.js                # Centralized configuration (ports, rate limits, env)
│   ├── logger.js                # Structured logging utility with Morgan integration
│   ├── db.js                    # SQLite database connection, schema, indexes, and seed
│   ├── middleware/
│   │   ├── errorHandler.js      # Centralized error handler
│   │   ├── rateLimiter.js       # Express rate limiting policies
│   │   └── validate.js          # Express-validator result parser
│   └── routes/
│       ├── health.js            # Health diagnosis route
│       ├── internships.js       # Internships CRUD & filter endpoints
│       └── applications.js      # Candidate application endpoints
├── public/                      # Static client assets
│   ├── index.html               # Accessible HTML5 structure
│   ├── style.css                # Modern design system & responsive styling
│   └── app.js                   # Client controller, API client, modal logic
├── tests/
│   └── api.test.js              # Integration and regression test suite
└── package.json                 # Project dependencies & scripts
```

---

## 🧠 Engineering Reflection & Summary

This capstone brings together all previous tasks into a single coherent portal. Rather than relying on external component frameworks, writing standard HTML, CSS, and vanilla JS demonstrates clear fundamental mastery of DOM events, accessibility patterns, and network handling. 

On the server side, defense-in-depth ensures the API is safe from abuse: helmet handles browser-level security headers, rate limiting prevents brute-force submissions, parameterized SQL statements prevent data leakage, and a dual-tier validation strategy ensures clean, trusted records enter the database. The inclusion of production monitoring patterns (`/health`, structured JSON logging, and graceful shutdown hooks) ensures the system is genuinely ready for deployment.
