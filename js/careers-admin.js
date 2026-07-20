// js/careers-admin.js
// Admin: create/edit/delete job postings ("jobs" collection) and
// review/advance applicants ("applications" collection).
// Public site (careers.html) reads "jobs" where status == "open".

import {
  db,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// "role" is stored as "Title — Subsidiary" (needed elsewhere to match the
// job card), but the Subsidiary is already shown in its own field/column —
// so strip that suffix wherever the role is displayed on its own.
function roleOnly(role) {
  return String(role || "").split(" — ")[0].trim();
}

// Cloudinary serves files cross-origin, so a plain `download` attribute is
// often ignored by the browser. Asking Cloudinary itself to attach the file
// under a specific name (fl_attachment) is the reliable way to make the
// downloaded file keep the applicant's original filename.
function buildCloudinaryDownloadUrl(url, filename) {
  if (!url || !filename) return url;
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  // Cloudinary transformation segments only tolerate letters, numbers, hyphens
  // and underscores — spaces, parentheses, etc. break the transformation
  // parser and cause a 400, even though encodeURIComponent leaves them alone.
  const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "file";
  return url.includes("/upload/")
    ? url.replace("/upload/", `/upload/fl_attachment:${safeName}/`)
    : url;
}

const COMPANY_LABELS = {
  msmart: "M-Smart Driving School Solution",
  mfood: "M-Digital Food Chain",
  mevents: "M-Events & Festivals",
  mfarms: "M-Farms",
  mconsultancy: "M-Consultancy & Training",
  general: "Marvini Group",
};

const APPLICANT_TYPE_LABELS = {
  career: "Career",
  volunteer: "Volunteer",
  internship: "Internship",
};

/* ── JOB POSTINGS ─────────────────────────────────────── */

const jobModal = document.getElementById("jobModal");
const jobForm = document.getElementById("jobForm");
const jobModalTitle = document.getElementById("jobModalTitle");
const jobSubmitBtn = document.getElementById("jobSubmitBtn");
const jobsTableBody = document.getElementById("jobsTableBody");

function openJobModal(editData = null, editId = null) {
  jobForm.reset();
  document.getElementById("jobDocId").value = editId || "";
  if (editData) {
    jobModalTitle.textContent = "Edit Posting";
    document.getElementById("jobTitle").value = editData.title || "";
    document.getElementById("jobCompanyKey").value = editData.companyKey || "";
    document.getElementById("jobType").value = editData.type || "career";
    document.getElementById("jobSchedule").value = editData.schedule || "";
    document.getElementById("jobOverview").value = editData.overview || editData.description || "";
    document.getElementById("jobResponsibilities").value = (editData.responsibilities || []).join("\n");
    document.getElementById("jobRequirements").value = (editData.requirements || []).join("\n");
    document.getElementById("jobReportingLine").value = editData.reportingLine || "";
    document.getElementById("jobStatus").value = editData.status || "open";
    document.getElementById("jobDurationValue").value = editData.durationValue || "";
    document.getElementById("jobDurationUnit").value = editData.durationUnit || "months";
  } else {
    jobModalTitle.textContent = "Post New Opening";
  }
  jobModal.classList.add("open");
}
function closeJobModal() { jobModal.classList.remove("open"); }

document.getElementById("openJobBtn")?.addEventListener("click", () => openJobModal());
document.getElementById("closeJobBtn")?.addEventListener("click", closeJobModal);
jobModal?.addEventListener("click", (e) => { if (e.target === jobModal) closeJobModal(); });

jobForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  jobSubmitBtn.disabled = true;

  const editId = document.getElementById("jobDocId").value;
  const companyKey = document.getElementById("jobCompanyKey").value;

  const durationValue = document.getElementById("jobDurationValue").value.trim();

  const responsibilities = document.getElementById("jobResponsibilities").value
    .split("\n").map((line) => line.trim()).filter(Boolean);
  const requirements = document.getElementById("jobRequirements").value
    .split("\n").map((line) => line.trim()).filter(Boolean);
  const overview = document.getElementById("jobOverview").value.trim();

  const data = {
    title: document.getElementById("jobTitle").value.trim(),
    companyKey,
    companyLabel: COMPANY_LABELS[companyKey] || companyKey,
    type: document.getElementById("jobType").value,
    schedule: document.getElementById("jobSchedule").value.trim(),
    overview,
    description: overview, // kept for backward compatibility with the card front-face text
    responsibilities,
    requirements,
    reportingLine: document.getElementById("jobReportingLine").value.trim(),
    status: document.getElementById("jobStatus").value,
    durationValue: durationValue ? Number(durationValue) : null,
    durationUnit: document.getElementById("jobDurationUnit").value,
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "jobs", editId), data);
    } else {
      await addDoc(collection(db, "jobs"), { ...data, createdAt: serverTimestamp() });
    }
    closeJobModal();
  } catch (err) {
    console.error("Could not save job posting:", err);
    await uiAlert("Could not save. Check console for details.", { title: "Error", danger: true });
  } finally {
    jobSubmitBtn.disabled = false;
  }
});

const TYPE_LABELS = { career: "Career", volunteer: "Volunteer", internship: "Internship" };
const TYPE_PILL_CLASS = { career: "active", volunteer: "completed", internship: "pending" };

function formatDuration(data) {
  if (!data.durationValue) return "";
  const unitLabel = data.durationUnit === "years"
    ? (data.durationValue === 1 ? "year" : "years")
    : (data.durationValue === 1 ? "month" : "months");
  return `${data.durationValue} ${unitLabel}`;
}

function buildJobRow(id, data) {
  const tr = document.createElement("tr");
  const typeLabel = TYPE_LABELS[data.type] || "Career";
  tr.dataset.category = typeLabel;
  const durationStr = formatDuration(data);
  tr.innerHTML = `
    <td><strong>${escapeHtml(data.title || "")}</strong></td>
    <td>${escapeHtml(data.companyLabel || "")}</td>
    <td><span class="pill ${TYPE_PILL_CLASS[data.type] || "active"}">${typeLabel}</span></td>
    <td>${escapeHtml(data.schedule || "")}${durationStr ? ` · ${durationStr}` : ""}</td>
    <td><span class="pill ${isOpenStatus(data.status) ? "completed" : "draft"}">${isOpenStatus(data.status) ? "Open" : "Draft"}</span></td>
    <td>
      <div class="row-actions">
        <button aria-label="Edit" title="Edit" data-edit><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></button>
        <button aria-label="Remove" title="Remove" class="danger" data-remove><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
      </div>
    </td>
  `;
  tr.querySelector("[data-edit]").addEventListener("click", () => openJobModal(data, id));
  tr.querySelector("[data-remove]").addEventListener("click", async () => {
    const confirmed = await uiConfirm(`Remove "${data.title || "this posting"}"? This cannot be undone.`, {
      title: "Remove Posting", confirmText: "Remove", danger: true
    });
    if (!confirmed) return;
    try { await deleteDoc(doc(db, "jobs", id)); }
    catch (err) { console.error(err); await uiAlert("Could not remove. Check console.", { title: "Error", danger: true }); }
  });
  return tr;
}

function isOpenStatus(status) {
  return String(status || "").trim().toLowerCase() === "open";
}

let jobDocs = [];
onSnapshot(collection(db, "jobs"), (snap) => {
  jobDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  jobsTableBody.innerHTML = "";
  if (jobDocs.length === 0) {
    jobsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No postings yet. Click "Post New Opening" to add one.</td></tr>`;
  } else {
    jobDocs.forEach(({ id, data }) => jobsTableBody.appendChild(buildJobRow(id, data)));
  }
  document.getElementById("statOpenRoles").textContent =
    jobDocs.filter((j) => isOpenStatus(j.data.status)).length;
});

/* ── APPLICANTS ───────────────────────────────────────── */

const applicantsTableBody = document.getElementById("applicantsTableBody");
const STAGE_LABELS = {
  submitted: "New",
  under_review: "Under Review",
  interview: "Interview Scheduled",
  hired: "Hired",
  rejected: "Rejected",
};
const STAGE_PILL_CLASS = {
  submitted: "active",
  under_review: "pending",
  interview: "pending",
  hired: "completed",
  rejected: "draft",
};
const STAGE_ORDER = ["submitted", "under_review", "interview", "hired", "rejected"];

function buildApplicantRow(id, data) {
  const tr = document.createElement("tr");
  const stage = data.stage || "submitted";
  const initials = encodeURIComponent(data.applicantName || "Applicant");
  tr.innerHTML = `
    <td><div class="student-cell"><img src="https://ui-avatars.com/api/?name=${initials}&background=1a56ff&color=fff"/><div><strong>${escapeHtml(data.applicantName || "Unknown")}</strong><span>${APPLICANT_TYPE_LABELS[data.type] || "Career"}</span></div></div></td>
    <td>${escapeHtml(roleOnly(data.role))}</td>
    <td>${escapeHtml(COMPANY_LABELS[data.subsidiary] || data.subsidiary || "")}</td>
    <td><span class="pill ${STAGE_PILL_CLASS[stage] || "active"}">${STAGE_LABELS[stage] || stage}</span></td>
    <td>
      <div class="row-actions">
        <button aria-label="View applicant" data-view title="View details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button aria-label="Advance stage" data-advance title="Advance stage"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
        <button aria-label="Remove" title="Remove" class="danger" data-remove><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
      </div>
    </td>
  `;
  tr.querySelector("[data-view]").addEventListener("click", () => openApplicantModal(data));
  tr.querySelector("[data-advance]").addEventListener("click", async () => {
    const idx = STAGE_ORDER.indexOf(stage);
    const next = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 2)]; // stop before "rejected" on auto-advance
    try { await updateDoc(doc(db, "applications", id), { stage: next }); }
    catch (err) { console.error(err); await uiAlert("Could not update stage.", { title: "Error", danger: true }); }
  });
  tr.querySelector("[data-remove]").addEventListener("click", async () => {
    const confirmed = await uiConfirm(`Remove application from ${data.applicantName || "this applicant"}?`, {
      title: "Remove Application", confirmText: "Remove", danger: true
    });
    if (!confirmed) return;
    try { await deleteDoc(doc(db, "applications", id)); }
    catch (err) { console.error(err); await uiAlert("Could not remove. Check console.", { title: "Error", danger: true }); }
  });
  return tr;
}

/* ── APPLICANT VIEW MODAL ─────────────────────────────── */

const applicantViewModal = document.getElementById("applicantViewModal");

function openApplicantModal(data) {
  document.getElementById("viewApplicantName").textContent = data.applicantName || "—";
  document.getElementById("viewApplicantEmail").innerHTML = data.email
    ? `<a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a>` : "—";
  document.getElementById("viewApplicantPhone").innerHTML = data.phone
    ? `<a href="tel:${escapeHtml(data.phone)}">${escapeHtml(data.phone)}</a>` : "—";
  document.getElementById("viewApplicantRole").textContent = roleOnly(data.role) || "—";
  document.getElementById("viewApplicantSubsidiary").textContent = COMPANY_LABELS[data.subsidiary] || data.subsidiary || "—";
  document.getElementById("viewApplicantType").textContent = APPLICANT_TYPE_LABELS[data.type] || "Career";
  document.getElementById("viewApplicantStage").textContent = STAGE_LABELS[data.stage || "submitted"] || data.stage;

  const resumeWrap = document.getElementById("viewApplicantResumeLinkWrap");
  const resumeEl = document.getElementById("viewApplicantResumeLink");
  if (data.resumeLink) {
    resumeEl.innerHTML = `<a href="${escapeHtml(data.resumeLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.resumeLink)}</a>`;
    resumeWrap.style.display = "flex";
  } else {
    resumeWrap.style.display = "none";
  }

  const msgWrap = document.getElementById("viewApplicantMessageWrap");
  const msgEl = document.getElementById("viewApplicantMessage");
  if (data.message) {
    msgEl.textContent = data.message;
    msgWrap.style.display = "flex";
  } else {
    msgWrap.style.display = "none";
  }

  const cvStatus = document.getElementById("viewApplicantCvStatus");
  const cvDownload = document.getElementById("viewApplicantCvDownload");
  if (data.cvUrl) {
    cvStatus.textContent = "CV attached.";
    cvDownload.href = buildCloudinaryDownloadUrl(data.cvUrl, data.cvFileName);
    cvDownload.setAttribute("download", data.cvFileName || "");
    cvDownload.style.display = "inline-flex";
  } else {
    cvStatus.textContent = "No CV attached.";
    cvDownload.style.display = "none";
  }

  const coverStatus = document.getElementById("viewApplicantCoverStatus");
  const coverDownload = document.getElementById("viewApplicantCoverDownload");
  if (data.coverLetterUrl) {
    coverStatus.textContent = "Cover letter attached.";
    coverDownload.href = buildCloudinaryDownloadUrl(data.coverLetterUrl, data.coverLetterFileName);
    coverDownload.setAttribute("download", data.coverLetterFileName || "");
    coverDownload.style.display = "inline-flex";
  } else {
    coverStatus.textContent = "No cover letter attached.";
    coverDownload.style.display = "none";
  }

  applicantViewModal.classList.add("open");
}
function closeApplicantModal() { applicantViewModal.classList.remove("open"); }
document.getElementById("closeApplicantViewBtn")?.addEventListener("click", closeApplicantModal);
applicantViewModal?.addEventListener("click", (e) => { if (e.target === applicantViewModal) closeApplicantModal(); });

onSnapshot(collection(db, "applications"), (snap) => {
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  docs.sort((a, b) => (b.data.createdAt?.toMillis?.() || 0) - (a.data.createdAt?.toMillis?.() || 0));

  applicantsTableBody.innerHTML = "";
  if (docs.length === 0) {
    applicantsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">No applications yet.</td></tr>`;
  } else {
    docs.forEach(({ id, data }) => applicantsTableBody.appendChild(buildApplicantRow(id, data)));
  }

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = docs.filter((d) => (d.data.createdAt?.toMillis?.() || 0) >= thirtyDaysAgo).length;
  const interviews = docs.filter((d) => d.data.stage === "interview").length;
  const hired = docs.filter((d) => d.data.stage === "hired").length;

  document.getElementById("statApplications30d").textContent = recent;
  document.getElementById("statInterviews").textContent = interviews;
  document.getElementById("statHired").textContent = hired;

  // Mini pipeline roadmap — mirrors the dashboard's stage widget so the
  // admin can see where applications stand without leaving this page.
  const stageCounts = { submitted: 0, under_review: 0, interview: 0, hired: 0 };
  docs.forEach(({ data }) => {
    const stage = data.stage || "submitted";
    if (stage in stageCounts) stageCounts[stage]++;
  });

  const pmMap = {
    pmSubmitted: stageCounts.submitted,
    pmReviewed: stageCounts.under_review,
    pmInterview: stageCounts.interview,
    pmHired: stageCounts.hired,
  };
  Object.entries(pmMap).forEach(([id, count]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.classList.toggle("empty", count === 0);
  });
});