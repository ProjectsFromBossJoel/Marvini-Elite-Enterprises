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
  updateDoc,
  deleteDoc,
} from "./firebase-config.js";

const LEADS_COLLECTION = "consultancyTrainingLeads";

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
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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
          <button class="btn btn-outline btn-sm" data-view="${lead.id}">View</button>
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
  if (!confirm("Delete this enquiry? This can't be undone.")) return;
  await deleteDoc(doc(db, LEADS_COLLECTION, activeLeadId));
  closeLeadModal();
});