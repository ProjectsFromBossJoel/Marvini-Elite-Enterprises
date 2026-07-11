// js/consultancy-training-admin.js
// Powers dashboard/consultancy-training.html — lists leads submitted from the
// public Consultancy & Training page (collection: consultancyTrainingLeads).

import {
  db,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "./firebase-config.js";
import { uploadToCloudinary } from "./cloudinary.js";

const LEADS_COLLECTION = "consultancyTrainingLeads";
const PROGRAMS_COLLECTION = "consultancyPrograms";

// ---------------- Reusable confirm modal (replaces confirm()) ----------------
const confirmModal = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const confirmOkBtn = document.getElementById("confirmOkBtn");
let confirmResolver = null;

function askConfirm(message, title = "Are you sure?") {
  confirmModalTitle.textContent = title;
  confirmModalMessage.textContent = message;
  confirmModal.classList.add("open");
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirmModal(result) {
  confirmModal.classList.remove("open");
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

confirmCancelBtn.addEventListener("click", () => closeConfirmModal(false));
confirmOkBtn.addEventListener("click", () => closeConfirmModal(true));
confirmModal.addEventListener("click", (e) => {
  if (e.target === confirmModal) closeConfirmModal(false);
});

const tableBody = document.getElementById("leadsTableBody");
const emptyState = document.getElementById("leadsEmptyState");
const filterTabs = document.getElementById("filterTabs");
const consultancyNavBadge = document.getElementById("consultancyNavBadge");

let allLeads = [];
let activeFilter = "all";
let activeLeadId = null;

function formatDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return "—";
  const d = timestamp.toDate();
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function statusLabel(status) {
  if (status === "contacted") return "Contacted";
  if (status === "closed") return "Closed";
  return "New";
}

function typeLabel(type) {
  return type === "training" ? "Training" : "Consultation";
}

function matchesFilter(lead) {
  if (activeFilter === "all") return true;
  if (activeFilter === "consultation" || activeFilter === "training") return lead.type === activeFilter;
  return (lead.status || "new") === activeFilter;
}

function renderRows() {
  const rows = allLeads.filter(matchesFilter);
  tableBody.innerHTML = "";

  if (rows.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  rows.forEach((lead) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(lead.name || "—")}</strong>
        ${lead.organisation ? `<div class="row-sub">${escapeHtml(lead.organisation)}</div>` : ""}
      </td>
      <td><span class="pill type-${lead.type === "training" ? "training" : "consultation"}">${typeLabel(lead.type)}</span></td>
      <td>${lead.type === "training" ? escapeHtml(lead.program || "—") : "—"}</td>
      <td>
        ${escapeHtml(lead.email || "—")}
        ${lead.phone ? `<div class="row-sub">${escapeHtml(lead.phone)}</div>` : ""}
      </td>
      <td><span class="pill status-${lead.status || "new"}">${statusLabel(lead.status)}</span></td>
      <td>${formatDate(lead.createdAt)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-outline btn-icon" data-view="${lead.id}" title="View" aria-label="View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  tableBody.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => openLeadModal(btn.dataset.view));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Deterministic color per partner name — same partner always gets the
// same tag color, no manual color picking needed in the admin form.
const PARTNER_TAG_PALETTE = [
  { bg: "rgba(26,86,255,0.12)", fg: "#1a56ff" },
  { bg: "rgba(166,84,42,0.12)", fg: "#A6542A" },
  { bg: "rgba(79,107,79,0.14)", fg: "#3C543C" },
  { bg: "rgba(180,83,9,0.12)", fg: "#B45309" },
  { bg: "rgba(5,150,105,0.12)", fg: "#047857" },
  { bg: "rgba(147,51,234,0.12)", fg: "#7C3AED" },
];

function partnerTagColor(name) {
  if (!name) return PARTNER_TAG_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PARTNER_TAG_PALETTE[hash % PARTNER_TAG_PALETTE.length];
}

function updateNavBadge() {
  if (!consultancyNavBadge) return;
  const newCount = allLeads.filter((l) => (l.status || "new") === "new").length;
  consultancyNavBadge.textContent = String(newCount);
}

// ---------------- Live Firestore subscription ----------------
const leadsQuery = query(collection(db, LEADS_COLLECTION), orderBy("createdAt", "desc"));

onSnapshot(leadsQuery, (snapshot) => {
  allLeads = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderRows();
  updateNavBadge();
}, (err) => {
  console.error("Error loading consultancy/training leads:", err);
  emptyState.textContent = "Couldn't load enquiries — check your connection or Firestore rules.";
  emptyState.style.display = "block";
});

// ---------------- Filter tabs ----------------
filterTabs.querySelectorAll(".filter-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    filterTabs.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeFilter = tab.dataset.filter;
    renderRows();
  });
});

// ---------------- Lead detail modal ----------------
const leadModal = document.getElementById("leadModal");
const closeLeadBtn = document.getElementById("closeLeadBtn");
const markContactedBtn = document.getElementById("markContactedBtn");
const markClosedBtn = document.getElementById("markClosedBtn");
const deleteLeadBtn = document.getElementById("deleteLeadBtn");

function openLeadModal(leadId) {
  const lead = allLeads.find((l) => l.id === leadId);
  if (!lead) return;
  activeLeadId = leadId;

  document.getElementById("leadName").textContent = lead.name || "—";
  document.getElementById("leadOrg").textContent = lead.organisation || "—";
  document.getElementById("leadEmail").textContent = lead.email || "—";
  document.getElementById("leadPhone").textContent = lead.phone || "—";
  document.getElementById("leadType").textContent = typeLabel(lead.type);
  document.getElementById("leadMessage").textContent = lead.message || "—";
  document.getElementById("leadDate").textContent = formatDate(lead.createdAt);

  const programRow = document.getElementById("leadProgramRow");
  if (lead.type === "training") {
    programRow.style.display = "flex";
    document.getElementById("leadProgram").textContent = lead.program || "—";
  } else {
    programRow.style.display = "none";
  }

  leadModal.classList.add("open");
}

function closeLeadModal() {
  leadModal.classList.remove("open");
  activeLeadId = null;
}

closeLeadBtn.addEventListener("click", closeLeadModal);
leadModal.addEventListener("click", (e) => {
  if (e.target === leadModal) closeLeadModal();
});

markContactedBtn.addEventListener("click", async () => {
  if (!activeLeadId) return;
  await updateDoc(doc(db, LEADS_COLLECTION, activeLeadId), { status: "contacted" });
  closeLeadModal();
});

markClosedBtn.addEventListener("click", async () => {
  if (!activeLeadId) return;
  await updateDoc(doc(db, LEADS_COLLECTION, activeLeadId), { status: "closed" });
  closeLeadModal();
});

deleteLeadBtn.addEventListener("click", async () => {
  if (!activeLeadId) return;
  const ok = await askConfirm("This enquiry will be permanently deleted.", "Delete this enquiry?");
  if (!ok) return;
  await deleteDoc(doc(db, LEADS_COLLECTION, activeLeadId));
  closeLeadModal();
});

// =====================================================================
// Upcoming Training Programs — shown live on the public
// Consultancy & Training page's "Upcoming Programs" section.
// =====================================================================

const programsTableBody = document.getElementById("programsTableBody");
const programsEmptyState = document.getElementById("programsEmptyState");
let allPrograms = [];

function renderProgramRows() {
  programsTableBody.innerHTML = "";

  if (allPrograms.length === 0) {
    programsEmptyState.style.display = "block";
    return;
  }
  programsEmptyState.style.display = "none";

  allPrograms.forEach((p) => {
    const tr = document.createElement("tr");
    const partnerTagHtml = p.partner
      ? (() => {
          const c = partnerTagColor(p.partner);
          return `<span class="pill" style="background:${c.bg};color:${c.fg};margin-top:.35rem;display:inline-block;">${escapeHtml(p.partner)}</span>`;
        })()
      : "";
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(p.title || "—")}</strong>
        <div class="row-sub">${escapeHtml(p.description || "")}</div>
        ${p.venue ? `<div class="row-sub">📍 ${escapeHtml(p.venue)}</div>` : ""}
        ${partnerTagHtml}
      </td>
      <td>${escapeHtml(p.format || "—")}</td>
      <td>
        ${formatProgramDate(p.startDate)}
        <div class="row-sub">${formatTime12h(p.startTime) || "—"}</div>
      </td>
      <td>
        ${formatProgramDate(p.endDate)}
        <div class="row-sub">${formatTime12h(p.endTime) || "—"}</div>
      </td>
      <td>${escapeHtml(p.duration || "—")}</td>
      <td>${escapeHtml(p.note || "—")}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-outline btn-icon" data-edit-program="${p.id}" title="Edit" aria-label="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg>
          </button>
          <button class="btn btn-danger btn-icon" data-delete-program="${p.id}" title="Delete" aria-label="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </td>
    `;
    programsTableBody.appendChild(tr);
  });

  programsTableBody.querySelectorAll("[data-edit-program]").forEach((btn) => {
    btn.addEventListener("click", () => openProgramModal(btn.dataset.editProgram));
  });
  programsTableBody.querySelectorAll("[data-delete-program]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await askConfirm("It will be removed from the live page immediately.", "Delete this program?");
      if (!ok) return;
      await deleteDoc(doc(db, PROGRAMS_COLLECTION, btn.dataset.deleteProgram));
    });
  });
}

const programsQuery = query(collection(db, PROGRAMS_COLLECTION), orderBy("createdAt", "desc"));
onSnapshot(programsQuery, (snapshot) => {
  allPrograms = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderProgramRows();
}, (err) => {
  console.error("Error loading training programs:", err);
  programsEmptyState.textContent = "Couldn't load programs — check your connection or Firestore rules.";
  programsEmptyState.style.display = "block";
});

// ---------------- Program add/edit modal ----------------
const programModal = document.getElementById("programModal");
const programModalTitle = document.getElementById("programModalTitle");
const openProgramBtn = document.getElementById("openProgramBtn");
const closeProgramBtn = document.getElementById("closeProgramBtn");
const programForm = document.getElementById("programForm");
const programIdField = document.getElementById("programId");
const programTitleField = document.getElementById("programTitle");
const programFormatField = document.getElementById("programFormat");
const programDurationField = document.getElementById("programDuration");
const programStartDateField = document.getElementById("programStartDate");
const programEndDateField = document.getElementById("programEndDate");
const programStartTimeField = document.getElementById("programStartTime");
const programEndTimeField = document.getElementById("programEndTime");
const programDescriptionField = document.getElementById("programDescription");
const programVenueField = document.getElementById("programVenue");
const programPartnerField = document.getElementById("programPartner");
const programCoverField = document.getElementById("programCover");
const programNoteField = document.getElementById("programNote");
const programSubmitBtn = document.getElementById("programSubmitBtn");
const programFormStatus = document.getElementById("programFormStatus");

// ---------------- Auto-calculated Duration ----------------
function formatTime12h(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatProgramDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function computeDuration() {
  const start = programStartDateField.value;
  const end = programEndDateField.value;
  if (!start || !end) {
    programDurationField.value = "";
    return;
  }
  const startD = new Date(start + "T00:00:00");
  const endD = new Date(end + "T00:00:00");
  const dayCount = Math.round((endD - startD) / 86400000) + 1;

  if (dayCount <= 1) {
    const st = formatTime12h(programStartTimeField.value);
    const et = formatTime12h(programEndTimeField.value);
    programDurationField.value = st && et ? `${st} – ${et}` : "1 day";
  } else {
    programDurationField.value = `${dayCount} days`;
  }
}

[programStartDateField, programEndDateField, programStartTimeField, programEndTimeField].forEach((field) => {
  field.addEventListener("input", computeDuration);
});

function openProgramModal(programId) {
  programForm.reset();
  programFormStatus.textContent = "";
  programDurationField.value = "";

  if (programId) {
    const p = allPrograms.find((x) => x.id === programId);
    if (!p) return;
    programModalTitle.textContent = "Edit Training Program";
    programIdField.value = p.id;
    programTitleField.value = p.title || "";
    programFormatField.value = p.format || "";
    programStartDateField.value = p.startDate || "";
    programEndDateField.value = p.endDate || "";
    programStartTimeField.value = p.startTime || "";
    programEndTimeField.value = p.endTime || "";
    programDescriptionField.value = p.description || "";
    programVenueField.value = p.venue || "";
    programPartnerField.value = p.partner || "";
    programNoteField.value = p.note || "";
    programSubmitBtn.textContent = "Save Changes";
    computeDuration();
  } else {
    programModalTitle.textContent = "Add Training Program";
    programIdField.value = "";
    programSubmitBtn.textContent = "Save Program";
  }

  programModal.classList.add("open");
}

function closeProgramModal() {
  programModal.classList.remove("open");
}

openProgramBtn.addEventListener("click", () => openProgramModal(null));
closeProgramBtn.addEventListener("click", closeProgramModal);
programModal.addEventListener("click", (e) => {
  if (e.target === programModal) closeProgramModal();
});

programForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  computeDuration();
  programSubmitBtn.disabled = true;
  programFormStatus.textContent = "";
  programFormStatus.style.color = "";

  const payload = {
    title: programTitleField.value.trim(),
    format: programFormatField.value.trim(),
    startDate: programStartDateField.value,
    endDate: programEndDateField.value,
    startTime: programStartTimeField.value,
    endTime: programEndTimeField.value,
    duration: programDurationField.value.trim(),
    description: programDescriptionField.value.trim(),
    venue: programVenueField.value.trim(),
    partner: programPartnerField.value.trim(),
    note: programNoteField.value.trim(),
  };

  try {
    const coverFile = programCoverField.files[0];
    if (coverFile) {
      programFormStatus.textContent = "Uploading image…";
      const coverResult = await uploadToCloudinary(coverFile, "image", "marvini-programs", "marvini_programs");
      payload.coverImageUrl = coverResult.url;
      payload.coverPublicId = coverResult.publicId;
    }

    programFormStatus.textContent = "Saving…";
    const existingId = programIdField.value;
    if (existingId) {
      await updateDoc(doc(db, PROGRAMS_COLLECTION, existingId), payload);
    } else {
      await addDoc(collection(db, PROGRAMS_COLLECTION), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    closeProgramModal();
  } catch (err) {
    console.error("Error saving program:", err);
    programFormStatus.textContent = "Couldn't save — please try again.";
    programFormStatus.style.color = "#A6542A";
  } finally {
    programSubmitBtn.disabled = false;
  }
});