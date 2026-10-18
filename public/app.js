// ========================================================
//  InternBoard Capstone Frontend Controller (app.js)
//  Robust async state, API connection, error mappings
// ========================================================

const API = "/api";

// ── Application State ────────────────────────
const state = {
  query:      "",
  domain:     "All",
  mode:       "",
  sort:       "newest",
  page:       1,
  limit:      9,
  total:      0,
  totalPages: 1,
  domains:    [],
  isLoading:  false,
};

// ── DOM References ───────────────────────────
const grid           = document.getElementById("card-grid");
const searchInput    = document.getElementById("search-input");
const clearBtn       = document.getElementById("clear-btn");
const modeSelect     = document.getElementById("mode-select");
const sortSelect     = document.getElementById("sort-select");
const resultCount    = document.getElementById("result-count");
const filterList     = document.getElementById("domain-filters");
const liveRegion     = document.getElementById("live-region");
const paginationNav  = document.getElementById("pagination");
const headerCount    = document.getElementById("header-count");
const systemStatus   = document.getElementById("system-status");

// Modal Elements
const modal          = document.getElementById("apply-modal");
const modalTitle     = document.getElementById("modal-title");
const modalCompany   = document.getElementById("modal-company");
const modalClose     = document.getElementById("modal-close");
const modalCancel    = document.getElementById("modal-cancel-btn");
const modalDoneBtn   = document.getElementById("modal-done-btn");
const applyForm      = document.getElementById("apply-form");
const modalSuccess   = document.getElementById("modal-success");
const submitBtn      = document.getElementById("form-submit-btn");
const coverTextarea  = document.getElementById("applicant-cover");
const coverCount     = document.getElementById("cover-count");
const serverBanner   = document.getElementById("server-error-banner");

let openerBtn = null;
let activeInternshipId = null;

// ── Utilities ────────────────────────────────
function esc(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function announce(msg) {
  liveRegion.textContent = "";
  setTimeout(() => { liveRegion.textContent = msg; }, 100);
}

// ── API Fetchers ─────────────────────────────
async function fetchInternships() {
  const params = new URLSearchParams({
    page:  state.page,
    limit: state.limit,
    sort:  state.sort,
  });

  if (state.query)          params.set("search", state.query);
  if (state.domain !== "All") params.set("domain", state.domain);
  if (state.mode)           params.set("mode", state.mode);

  const res = await fetch(`${API}/internships?${params.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API error: ${res.status}`);
  }
  return res.json();
}

async function fetchMeta() {
  const res = await fetch(`${API}/internships/meta`);
  if (!res.ok) throw new Error("Metadata request failed");
  return res.json();
}

async function verifyHealth() {
  try {
    const res = await fetch("/health");
    if (res.ok) {
      systemStatus.innerHTML = '<span class="status-dot"></span> System Operational';
      systemStatus.style.color = "var(--clr-text-muted)";
    } else {
      systemStatus.innerHTML = '<span class="status-dot" style="background:var(--clr-danger)"></span> API Degraded';
    }
  } catch {
    systemStatus.innerHTML = '<span class="status-dot" style="background:var(--clr-danger)"></span> Offline';
  }
}

// ── UI Rendering: Filters ────────────────────
function buildDomainFilters(domains) {
  state.domains = ["All", ...domains];
  filterList.innerHTML = "";

  state.domains.forEach((dom) => {
    const li  = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = dom;
    btn.className = "filter-pill";
    btn.setAttribute("aria-pressed", dom === state.domain ? "true" : "false");
    
    btn.addEventListener("click", () => {
      if (state.domain === dom) return;
      state.domain = dom;
      state.page = 1;
      buildDomainFilters(domains);
      loadAndRender();
    });

    li.appendChild(btn);
    filterList.appendChild(li);
  });
}

// ── Skeleton UI ──────────────────────────────
function renderSkeletons(count = 6) {
  grid.setAttribute("aria-busy", "true");
  grid.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton" aria-hidden="true">
      <div style="display:flex; justify-content:space-between;">
        <div class="skeleton-pulse" style="height:22px; width:80px; border-radius:12px;"></div>
        <div class="skeleton-pulse" style="height:22px; width:50px; border-radius:12px;"></div>
      </div>
      <div style="display:flex; gap:0.75rem; align-items:center;">
        <div class="skeleton-pulse" style="width:44px; height:44px; border-radius:8px;"></div>
        <div style="flex:1;">
          <div class="skeleton-pulse" style="height:18px; width:75%; margin-bottom:6px;"></div>
          <div class="skeleton-pulse" style="height:14px; width:45%;"></div>
        </div>
      </div>
      <div class="skeleton-pulse" style="height:14px; width:90%;"></div>
      <div class="skeleton-pulse" style="height:14px; width:65%;"></div>
      <div class="skeleton-pulse" style="height:36px; border-radius:6px; margin-top:auto;"></div>
    </div>
  `).join("");
}

// ── Empty & Error States ─────────────────────
function renderEmpty() {
  grid.innerHTML = `
    <div class="state-container" role="status">
      <div class="state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </div>
      <h2>No Matches Found</h2>
      <p>No internships matched your current filter criteria (${esc(state.query ? `"${state.query}"` : state.domain)}). Try refining your search query or reset filters.</p>
      <button type="button" class="reset-btn" id="reset-filters-btn">Reset All Filters</button>
    </div>
  `;
  document.getElementById("reset-filters-btn").addEventListener("click", resetAllFilters);
}

function renderError(message) {
  grid.innerHTML = `
    <div class="state-container error-state" role="alert">
      <div class="state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <h2>Unable to Load Listings</h2>
      <p>${esc(message || "An issue occurred while fetching the latest internship records from the API.")}</p>
      <button type="button" class="retry-btn" id="retry-btn">Retry Request</button>
    </div>
  `;
  document.getElementById("retry-btn").addEventListener("click", loadAndRender);
}

// ── Card Rendering ───────────────────────────
function createCard(item) {
  const card = document.createElement("article");
  card.className = "card";
  card.setAttribute("role", "listitem");
  card.setAttribute("aria-label", `${item.title} (${item.domain})`);

  // Distinct logo palette derived from id string
  const colors = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#7c3aed", "#db2777", "#2563eb", "#0d9488"];
  const colorIndex = Math.abs(item.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
  const logoBg = colors[colorIndex];
  const logoText = (item.title || "IN").slice(0, 2).toUpperCase();

  const isClosed = !item.applications_open;
  const skills = Array.isArray(item.skills) ? item.skills : [];

  card.innerHTML = `
    <div class="card-top">
      <span class="domain-badge">${esc(item.domain)}</span>
      ${isClosed ? `<span class="closed-badge" aria-label="Status: Closed">Closed</span>` : ""}
    </div>

    <div class="card-header">
      <div class="company-logo" style="background-color: ${logoBg};" aria-hidden="true">
        ${esc(logoText)}
      </div>
      <div>
        <h2 class="card-title">${esc(item.title)}</h2>
        <p class="card-location">${esc(item.location || "India")}</p>
      </div>
    </div>

    <ul class="card-meta" aria-label="Internship specifications">
      <li class="card-meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        <span>${esc(item.mode)}</span>
      </li>
      <li class="card-meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>${item.duration_weeks} Weeks</span>
      </li>
      ${item.stipend_monthly ? `
      <li class="card-meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <span>₹${Number(item.stipend_monthly).toLocaleString("en-IN")}/mo</span>
      </li>` : ""}
      <li class="card-meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>${item.openings} Opening${item.openings !== 1 ? "s" : ""}</span>
      </li>
    </ul>

    ${skills.length ? `
    <ul class="card-tags" aria-label="Skills required">
      ${skills.slice(0, 4).map(skill => `<li class="card-tag">${esc(skill)}</li>`).join("")}
    </ul>` : ""}

    <div class="card-footer">
      <span class="card-id">${esc(item.id)}</span>
      <button
        type="button"
        class="apply-btn"
        data-id="${esc(item.id)}"
        data-title="${esc(item.title)}"
        data-location="${esc(item.location || 'India')}"
        aria-label="Apply for ${esc(item.title)}"
        ${isClosed ? "disabled aria-disabled='true'" : ""}
      >
        ${isClosed ? "Closed" : "Apply Now"}
      </button>
    </div>
  `;
  return card;
}

// ── Pagination Rendering ─────────────────────
function renderPagination() {
  if (state.totalPages <= 1) {
    paginationNav.hidden = true;
    return;
  }

  paginationNav.hidden = false;
  paginationNav.innerHTML = "";

  const createBtn = (label, targetPage, disabled, isCurrent = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "page-btn" + (isCurrent ? " active" : "");
    btn.textContent = label;
    btn.disabled = disabled;
    if (isCurrent) btn.setAttribute("aria-current", "page");
    btn.addEventListener("click", () => {
      state.page = targetPage;
      loadAndRender();
      window.scrollTo({ top: grid.offsetTop - 100, behavior: "smooth" });
    });
    return btn;
  };

  // Previous
  paginationNav.appendChild(createBtn("← Prev", state.page - 1, state.page === 1));

  // Pages
  for (let p = 1; p <= state.totalPages; p++) {
    if (state.totalPages > 6 && Math.abs(p - state.page) > 2 && p !== 1 && p !== state.totalPages) {
      if (p === 2 || p === state.totalPages - 1) {
        const dot = document.createElement("span");
        dot.className = "page-ellipsis";
        dot.textContent = "…";
        paginationNav.appendChild(dot);
      }
      continue;
    }
    paginationNav.appendChild(createBtn(p, p, false, p === state.page));
  }

  // Next
  paginationNav.appendChild(createBtn("Next →", state.page + 1, state.page === state.totalPages));
}

// ── Main Load & Orchestrate ──────────────────
async function loadAndRender() {
  if (state.isLoading) return;
  state.isLoading = true;
  renderSkeletons();
  paginationNav.hidden = true;

  try {
    const response = await fetchInternships();
    const { data, pagination } = response;

    state.total      = pagination.total;
    state.totalPages = pagination.totalPages;

    grid.setAttribute("aria-busy", "false");
    grid.innerHTML = "";

    if (!data.length) {
      renderEmpty();
      updateResultCount(0);
      announce("No internships found matching your filters.");
      return;
    }

    data.forEach(item => {
      grid.appendChild(createCard(item));
    });

    updateResultCount(pagination.total, pagination.page, pagination.limit);
    renderPagination();
    announce(`Showing ${data.length} listings.`);

  } catch (err) {
    grid.setAttribute("aria-busy", "false");
    renderError(err.message);
    updateResultCount(0);
    announce("Failed to load internship opportunities.");
  } finally {
    state.isLoading = false;
  }
}

function updateResultCount(total, page = 1, limit = 9) {
  if (!total) {
    resultCount.innerHTML = "Found <strong>0</strong> internships";
    headerCount.textContent = "0 Positions Available";
    return;
  }
  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);
  resultCount.innerHTML = `Showing <strong>${start}–${end}</strong> of <strong>${total}</strong> opportunities`;
  headerCount.textContent = `${total} Positions Available`;
}

function resetAllFilters() {
  state.query  = "";
  state.domain = "All";
  state.mode   = "";
  state.sort   = "newest";
  state.page   = 1;

  searchInput.value = "";
  modeSelect.value  = "";
  sortSelect.value  = "newest";

  clearBtn.classList.remove("visible");
  clearBtn.setAttribute("aria-hidden", "true");
  clearBtn.tabIndex = -1;

  buildDomainFilters(state.domains.filter(d => d !== "All"));
  loadAndRender();
  searchInput.focus();
}

// ── Modal Operations ─────────────────────────
function openApplyModal(id, title, location, triggerElement) {
  openerBtn = triggerElement;
  activeInternshipId = id;

  modalTitle.textContent   = title;
  modalCompany.textContent = location;

  applyForm.reset();
  applyForm.hidden    = false;
  modalSuccess.hidden = true;
  serverBanner.hidden = true;
  coverCount.textContent = "0";
  clearAllValidationErrors();

  modal.removeAttribute("aria-hidden");
  modal.classList.add("open");
  document.body.classList.add("modal-open");
  modalClose.focus();
}

function closeApplyModal() {
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("open");
  document.body.classList.remove("modal-open");
  if (openerBtn) {
    openerBtn.focus();
    openerBtn = null;
  }
}

// Validation helpers
function setFieldError(fieldId, errorId, msg) {
  const el  = document.getElementById(fieldId);
  const err = document.getElementById(errorId);
  if (el) {
    el.classList.add("invalid");
    el.setAttribute("aria-invalid", "true");
  }
  if (err) err.textContent = msg;
}

function clearFieldError(fieldId, errorId) {
  const el  = document.getElementById(fieldId);
  const err = document.getElementById(errorId);
  if (el) {
    el.classList.remove("invalid");
    el.removeAttribute("aria-invalid");
  }
  if (err) err.textContent = "";
}

function clearAllValidationErrors() {
  [
    ["applicant-name",      "name-error"],
    ["applicant-email",     "email-error"],
    ["applicant-phone",     "phone-error"],
    ["applicant-portfolio", "portfolio-error"],
    ["applicant-cover",     "cover-error"],
  ].forEach(([f, e]) => clearFieldError(f, e));
}

function validateClientForm() {
  clearAllValidationErrors();
  let isValid = true;

  const name = document.getElementById("applicant-name").value.trim();
  if (!name) {
    setFieldError("applicant-name", "name-error", "Full name is required.");
    isValid = false;
  } else if (!/^[a-zA-Z\s.\-']+$/.test(name)) {
    setFieldError("applicant-name", "name-error", "Only letters and standard punctuation (. - ') permitted.");
    isValid = false;
  }

  const email = document.getElementById("applicant-email").value.trim();
  if (!email) {
    setFieldError("applicant-email", "email-error", "Email address is required.");
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError("applicant-email", "email-error", "Please enter a valid email format.");
    isValid = false;
  }

  const phone = document.getElementById("applicant-phone").value.trim();
  if (phone && !/^[+]?[\d\s\-().]{7,20}$/.test(phone)) {
    setFieldError("applicant-phone", "phone-error", "Please provide a valid contact number.");
    isValid = false;
  }

  const portfolio = document.getElementById("applicant-portfolio").value.trim();
  if (portfolio) {
    try {
      new URL(portfolio);
    } catch {
      setFieldError("applicant-portfolio", "portfolio-error", "Valid URL required (e.g., https://...).");
      isValid = false;
    }
  }

  const cover = coverTextarea.value.trim();
  if (!cover) {
    setFieldError("applicant-cover", "cover-error", "Please provide a statement or cover letter.");
    isValid = false;
  } else if (cover.length < 30) {
    setFieldError("applicant-cover", "cover-error", "Cover letter must be at least 30 characters.");
    isValid = false;
  }

  return isValid;
}

// ── Application Form Submission ──────────────
applyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateClientForm()) {
    applyForm.querySelector(".invalid")?.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Transmitting...";
  serverBanner.hidden = true;

  const payload = {
    internship_id:   activeInternshipId,
    applicant_name:  document.getElementById("applicant-name").value.trim(),
    applicant_email: document.getElementById("applicant-email").value.trim(),
    phone:           document.getElementById("applicant-phone").value.trim(),
    portfolio_url:   document.getElementById("applicant-portfolio").value.trim(),
    cover_letter:    coverTextarea.value.trim(),
  };

  try {
    const res = await fetch(`${API}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (res.ok) {
      applyForm.hidden    = true;
      modalSuccess.hidden = false;
      modalDoneBtn.focus();
    } else if (res.status === 422 && json.error?.fields) {
      // Map server-side validation error fields directly
      const fieldMap = {
        applicant_name:  ["applicant-name",      "name-error"],
        applicant_email: ["applicant-email",     "email-error"],
        phone:           ["applicant-phone",     "phone-error"],
        portfolio_url:   ["applicant-portfolio", "portfolio-error"],
        cover_letter:    ["applicant-cover",     "cover-error"],
      };

      json.error.fields.forEach(({ field, message }) => {
        const [fId, eId] = fieldMap[field] || [];
        if (fId) setFieldError(fId, eId, message);
      });
      applyForm.querySelector(".invalid")?.focus();
    } else {
      serverBanner.textContent = json.error?.message || "Application could not be processed. Please check details.";
      serverBanner.hidden = false;
      serverBanner.focus();
    }
  } catch {
    serverBanner.textContent = "Network error: unable to contact the API server. Please retry shortly.";
    serverBanner.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Application";
  }
});

// ── Event Bindings ───────────────────────────
let searchDebounce;
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.query = searchInput.value.trim();
    state.page  = 1;
    const hasQuery = state.query.length > 0;
    clearBtn.classList.toggle("visible", hasQuery);
    clearBtn.setAttribute("aria-hidden", hasQuery ? "false" : "true");
    clearBtn.tabIndex = hasQuery ? 0 : -1;
    loadAndRender();
  }, 250);
});

clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  state.query       = "";
  state.page        = 1;
  clearBtn.classList.remove("visible");
  clearBtn.setAttribute("aria-hidden", "true");
  clearBtn.tabIndex = -1;
  searchInput.focus();
  loadAndRender();
});

modeSelect.addEventListener("change", () => {
  state.mode = modeSelect.value;
  state.page = 1;
  loadAndRender();
});

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  state.page = 1;
  loadAndRender();
});

// Grid apply click delegation
grid.addEventListener("click", (e) => {
  const btn = e.target.closest("button.apply-btn[data-id]");
  if (!btn || btn.disabled) return;
  openApplyModal(btn.dataset.id, btn.dataset.title, btn.dataset.location, btn);
});

// Modal close actions
modalClose.addEventListener("click", closeApplyModal);
modalCancel.addEventListener("click", closeApplyModal);
modalDoneBtn.addEventListener("click", closeApplyModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeApplyModal(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("open")) {
    closeApplyModal();
  }
});

// Modal focus trap
modal.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || !modal.classList.contains("open")) return;
  const focusables = [...modal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
  )].filter(el => !el.closest("[hidden]"));

  if (!focusables.length) return;
  const first = focusables[0];
  const last  = focusables[focusables.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

coverTextarea.addEventListener("input", () => {
  coverCount.textContent = coverTextarea.value.length;
});

// ── Initialization ───────────────────────────
(async function init() {
  verifyHealth();
  try {
    const meta = await fetchMeta();
    buildDomainFilters(meta.data.domains || []);
  } catch {
    buildDomainFilters(["Web Development", "UI/UX", "Data Analytics", "Full Stack Development", "Cyber Security"]);
  }
  loadAndRender();
})();
