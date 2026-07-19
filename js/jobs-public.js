// js/jobs-public.js
// Public: render live "open" job postings into #jobsGrid,
// and populate the Apply modal's "Select Job" dropdown from the same data.

import { db, collection, onSnapshot } from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const grid = document.getElementById("jobsGrid");
const modalJobSelect = document.getElementById("modalJobSelect");

function refreshModalJobSelect(docs) {
  if (!modalJobSelect) return;
  const previousValue = modalJobSelect.value;

  const optionsHtml = docs
    .map(({ data }) => {
      const value = `${data.title || ""} — ${data.companyLabel || ""}`;
      return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
    })
    .join("");

  modalJobSelect.innerHTML =
    `<option value="">Select a role…</option>` +
    optionsHtml +
    `<option value="General / Not Listed">General / Not Listed</option>`;

  // Preserve the user's current selection if it still exists after refresh
  if ([...modalJobSelect.options].some((o) => o.value === previousValue)) {
    modalJobSelect.value = previousValue;
  }
}

onSnapshot(collection(db, "jobs"), (snap) => {
  const docs = snap.docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .filter((d) => d.data.status === "open");

  // Always keep the modal dropdown in sync with live Firestore jobs
  refreshModalJobSelect(docs);

  if (!grid) return;

  if (docs.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:2rem; opacity:0.6; font-family:'Poppins',sans-serif;">No openings right now — check back soon or send a general application below.</p>`;
    return;
  }

  const TYPE_LABELS = { career: "Career", volunteer: "Volunteer", internship: "Internship" };
  const TYPE_BADGE_CLASS = { career: "career", volunteer: "volunteer", internship: "internship" };


  grid.innerHTML = docs.map(({ data }) => {
    const jobType = data.type || "career";
    const typeLabel = TYPE_LABELS[jobType] || "Career";

    const responsibilitiesHtml = (data.responsibilities || []).length
      ? `<div class="job-detail-block"><strong>Key Responsibilities</strong><ul>${data.responsibilities.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul></div>`
      : "";
    const requirementsHtml = (data.requirements || []).length
      ? `<div class="job-detail-block"><strong>Requirements</strong><ul>${data.requirements.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul></div>`
      : "";
    const reportingLineHtml = data.reportingLine
      ? `<div class="job-detail-block"><strong>Reporting Line</strong><p>${escapeHtml(data.reportingLine)}</p></div>`
      : "";
    const detailsHtml = (responsibilitiesHtml || requirementsHtml || reportingLineHtml)
      ? `<details class="job-card-details"><summary>View full details</summary>${responsibilitiesHtml}${requirementsHtml}${reportingLineHtml}</details>`
      : "";

    return `
    <article class="job-card reveal-fade-up revealed" data-type="${escapeHtml(jobType)}" data-company="${escapeHtml(data.companyKey || "general")}">
      <div class="job-card-top">
        <span class="job-badge job-badge--${escapeHtml(jobType)}">${typeLabel}</span>
        <span class="job-type">${escapeHtml(data.schedule || "")}</span>
      </div>
      <h3 class="job-title">${escapeHtml(data.title || "")}</h3>
      <p class="job-company">${escapeHtml(data.companyLabel || "")}</p>
      <p class="job-desc">${escapeHtml(data.overview || data.description || "")}</p>
      ${detailsHtml}
      <div class="job-card-footer">
        <a href="#apply" class="btn btn-outline btn-sm apply-link" data-role="${escapeHtml(data.title || "")} — ${escapeHtml(data.companyLabel || "")}" data-track="${escapeHtml(jobType)}">Apply Now</a>
      </div>
    </article>
  `;
  }).join("");

  // Re-attach click handlers for the freshly rendered "Apply Now" links
  window.attachApplyLinkListeners?.();
});