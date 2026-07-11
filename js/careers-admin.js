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

const COMPANY_LABELS = {
  msmart: "M-Smart Driving School Solution",
  mfood: "M-Digital Food Chain",
  mevents: "M-Events & Festivals",
  mfarms: "M-Farms",
  mconsultancy: "M-Consultancy & Training",
  general: "Marvini Group",
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
    document.getElementById("jobDesc").value = editData.description || "";
    document.getElementById("jobStatus").value = editData.status || "open";
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

  const data = {
    title: document.getElementById("jobTitle").value.trim(),
    companyKey,
    companyLabel: COMPANY_LABELS[companyKey] || companyKey,
    type: document.getElementById("jobType").value,
    schedule: document.getElementById("jobSchedule").value.trim(),
    description: document.getElementById("jobDesc").value.trim(),
    status: document.getElementById("jobStatus").value,
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

function buildJobRow(id, data) {
  const tr = document.createElement("tr");
  tr.dataset.category = data.type === "volunteer" ? "Volunteer" : "Career";
  tr.innerHTML = `
    <td><strong>${escapeHtml(data.title || "")}</strong></td>
    <td>${escapeHtml(data.companyLabel || "")}</td>
    <td><span class="pill ${data.type === "volunteer" ? "completed" : "active"}">${data.type === "volunteer" ? "Volunteer" : "Career"}</span></td>
    <td>${escapeHtml(data.schedule || "")}</td>
    <td><span class="pill ${data.status === "open" ? "completed" : "draft"}">${data.status === "open" ? "Open" : "Draft"}</span></td>
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
    jobDocs.filter((j) => j.data.status === "open").length;
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
    <td><div class="student-cell"><img src="https://ui-avatars.com/api/?name=${initials}&background=1a56ff&color=fff"/><div><strong>${escapeHtml(data.applicantName || "Unknown")}</strong><span>${data.type === "volunteer" ? "Volunteer" : "Career"}</span></div></div></td>
    <td>${escapeHtml(data.role || "")}</td>
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
  document.getElementById("viewApplicantRole").textContent = data.role || "—";
  document.getElementById("viewApplicantSubsidiary").textContent = COMPANY_LABELS[data.subsidiary] || data.subsidiary || "—";
  document.getElementById("viewApplicantType").textContent = data.type === "volunteer" ? "Volunteer" : "Career";
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
    cvDownload.href = data.cvUrl;
    cvDownload.style.display = "inline-flex";
  } else {
    cvStatus.textContent = "No CV attached.";
    cvDownload.style.display = "none";
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