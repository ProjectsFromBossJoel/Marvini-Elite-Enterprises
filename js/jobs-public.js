// js/jobs-public.js
// Public: render live "open" job postings into #jobsGrid.
// Falls back to the hardcoded cards already in careers.html if empty.

import { db, collection, onSnapshot } from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const TYPE_ICON = { career: "💼", volunteer: "🤝" };
const grid = document.getElementById("jobsGrid");

if (grid) {
  onSnapshot(collection(db, "jobs"), (snap) => {
    const docs = snap.docs
      .map((d) => ({ id: d.id, data: d.data() }))
      .filter((d) => d.data.status === "open");

    if (docs.length === 0) return; // keep existing hardcoded fallback cards

    grid.innerHTML = docs.map(({ data }) => `
      <article class="job-card reveal-fade-up revealed" data-type="${escapeHtml(data.type || "career")}" data-company="${escapeHtml(data.companyKey || "general")}">
        <div class="job-card-top">
          <span class="job-badge job-badge--${data.type === "volunteer" ? "volunteer" : "career"}">${data.type === "volunteer" ? "Volunteer" : "Career"}</span>
          <span class="job-type">${escapeHtml(data.schedule || "")}</span>
        </div>
        <h3 class="job-title">${escapeHtml(data.title || "")}</h3>
        <p class="job-company">${escapeHtml(data.companyLabel || "")}</p>
        <p class="job-desc">${escapeHtml(data.description || "")}</p>
        <div class="job-card-footer">
          <a href="#apply" class="btn btn-outline btn-sm apply-link" data-role="${escapeHtml(data.title || "")} — ${escapeHtml(data.companyLabel || "")}" data-track="${escapeHtml(data.type || "career")}">Apply Now</a>
        </div>
      </article>
    `).join("");

    // Re-attach click handlers for the freshly rendered "Apply Now" links
    window.attachApplyLinkListeners?.();
  });
}