// js/companies-admin.js
// Admin: create/edit/delete Company subsidiaries (dashboard/companies.html).
// Public site (index.html #companies) reads the same "companies" collection
// where status == "published".

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

const grid = document.getElementById("companiesAdminGrid");
const emptyState = document.getElementById("companiesEmptyState");
const modal = document.getElementById("companyModal");
const form = document.getElementById("companyForm");
const modalTitle = document.getElementById("companyModalTitle");
const statusEl = document.getElementById("companyStatus");
const submitBtn = document.getElementById("companySubmitBtn");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function openModal(editData = null, editId = null) {
  form.reset();
  document.getElementById("companyDocId").value = editId || "";
  if (editData) {
    modalTitle.textContent = "Edit Company";
    document.getElementById("companyName").value = editData.name || "";
    document.getElementById("companyTag").value = editData.tag || "";
    document.getElementById("companyIcon").value = editData.icon || "";
    document.getElementById("companyDesc").value = editData.description || "";
    document.getElementById("companyWebsite").value = editData.websiteUrl || "";
    document.getElementById("companyLearnMore").value = editData.learnMoreUrl || "";
    document.getElementById("companyOrder").value = editData.order ?? "";
    document.getElementById("companyPublishNow").checked = editData.status === "published";
  } else {
    modalTitle.textContent = "Add Company";
    document.getElementById("companyPublishNow").checked = true;
  }
  statusEl.textContent = "";
  modal.classList.add("open");
}
function closeModal() { modal.classList.remove("open"); }

document.getElementById("openCompanyBtn")?.addEventListener("click", () => openModal());
document.getElementById("closeCompanyBtn")?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  statusEl.textContent = "Saving…";

  const editId = document.getElementById("companyDocId").value;
  const publishNow = document.getElementById("companyPublishNow").checked;
  const orderVal = document.getElementById("companyOrder").value;

  const data = {
    name: document.getElementById("companyName").value.trim(),
    tag: document.getElementById("companyTag").value.trim(),
    icon: document.getElementById("companyIcon").value.trim() || "🏢",
    description: document.getElementById("companyDesc").value.trim(),
    websiteUrl: document.getElementById("companyWebsite").value.trim(),
    learnMoreUrl: document.getElementById("companyLearnMore").value.trim(),
    order: orderVal === "" ? null : Number(orderVal),
    status: publishNow ? "published" : "draft",
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "companies", editId), data);
    } else {
      await addDoc(collection(db, "companies"), { ...data, createdAt: serverTimestamp() });
    }
    statusEl.textContent = "Saved.";
    setTimeout(closeModal, 500);
  } catch (err) {
    console.error("Could not save company:", err);
    statusEl.textContent = "⚠️ Could not save. Check console for details.";
  } finally {
    submitBtn.disabled = false;
  }
});

function buildCard(id, data) {
  const card = document.createElement("div");
  card.className = "content-card";
  card.innerHTML = `
    <div class="content-card-media">${escapeHtml(data.icon || "🏢")}<span class="cc-badge">${data.status === "published" ? "Published" : "Draft"}</span></div>
    <div class="content-card-body">
      <span class="content-card-tag">${escapeHtml(data.tag || "")}</span>
      <h3 class="content-card-title">${escapeHtml(data.name || "Untitled")}</h3>
      <p class="content-card-desc">${escapeHtml(data.description || "")}</p>
      <div class="content-card-footer">
        <button class="btn btn-outline btn-sm" data-edit>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>
          Edit
        </button>
        <button class="btn btn-danger-ghost btn-sm" data-remove>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          Remove
        </button>
      </div>
    </div>
  `;
  card.querySelector("[data-edit]").addEventListener("click", () => openModal(data, id));
  card.querySelector("[data-remove]").addEventListener("click", async () => {
    if (!confirm(`Remove ${data.name || "this company"}? This cannot be undone.`)) return;
    try { await deleteDoc(doc(db, "companies", id)); }
    catch (err) { console.error(err); alert("Could not remove. Check console."); }
  });
  return card;
}

onSnapshot(collection(db, "companies"), (snap) => {
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  docs.sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999));

  grid.innerHTML = "";
  if (docs.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
    docs.forEach(({ id, data }) => grid.appendChild(buildCard(id, data)));
  }

  const published = docs.filter((d) => d.data.status === "published").length;
  document.getElementById("statTotalCompanies").textContent = docs.length;
  document.getElementById("statPublishedCompanies").textContent = published;
  document.getElementById("statDraftCompanies").textContent = docs.length - published;
});