// js/partners-admin.js
// Admin: create/edit/delete Partners (dashboard/partners.html).
// Public site (index.html #partnersCarousel) reads the same "partners"
// collection where status == "published".

import {
  db,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "./firebase-config.js";
import { uploadToCloudinary } from "./cloudinary.js";

const grid = document.getElementById("partnersAdminGrid");
const emptyState = document.getElementById("partnersEmptyState");
const modal = document.getElementById("partnerModal");
const form = document.getElementById("partnerForm");
const modalTitle = document.getElementById("partnerModalTitle");
const statusEl = document.getElementById("partnerStatus");
const submitBtn = document.getElementById("partnerSubmitBtn");

const logoFile = document.getElementById("partnerLogoFile");
const logoFileName = document.getElementById("partnerLogoFileName");
const logoPreviewWrap = document.getElementById("partnerLogoPreviewWrap");
const logoPreview = document.getElementById("partnerLogoPreview");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

document.getElementById("partnerLogoLabel")?.addEventListener("click", (e) => {
  if (e.target !== logoFile) logoFile.click();
});
logoFile?.addEventListener("change", () => {
  const file = logoFile.files[0];
  if (!file) return;
  logoFileName.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    logoPreview.src = ev.target.result;
    logoPreviewWrap.style.display = "block";
  };
  reader.readAsDataURL(file);
});

function openModal(editData = null, editId = null) {
  form.reset();
  document.getElementById("partnerDocId").value = editId || "";
  logoFileName.textContent = "Choose a logo image…";
  logoPreviewWrap.style.display = "none";
  document.getElementById("partnerLogoProgress").style.display = "none";
  document.getElementById("partnerLogoProgressBar").style.width = "0%";

  if (editData) {
    modalTitle.textContent = "Edit Partner";
    document.getElementById("partnerName").value = editData.name || "";
    document.getElementById("partnerWebsite").value = editData.websiteUrl || "";
    document.getElementById("partnerLogo").value = editData.logoUrl || "";
    if (editData.logoUrl) {
      logoPreview.src = editData.logoUrl;
      logoPreviewWrap.style.display = "block";
      logoFileName.textContent = "Current logo (choose a file to replace)";
    }
  } else {
    modalTitle.textContent = "Add Partner";
    document.getElementById("partnerLogo").value = "";
  }
  statusEl.textContent = "";
  modal.classList.add("open");
}
function closeModal() {
  modal.classList.remove("open");
}
document.getElementById("openPartnerBtn")?.addEventListener("click", () => openModal());
document.getElementById("closePartnerBtn")?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  statusEl.textContent = "Saving…";

  const editId = document.getElementById("partnerDocId").value;

  try {
    let logoUrl = document.getElementById("partnerLogo").value.trim();
    const file = logoFile.files[0];
    if (file) {
      statusEl.textContent = "Uploading logo…";
      document.getElementById("partnerLogoProgress").style.display = "block";
      const result = await uploadToCloudinary(file, "image", "marvini/partners", "marvini_partners");
      logoUrl = result.url;
    }

    const data = {
      name: document.getElementById("partnerName").value.trim(),
      websiteUrl: document.getElementById("partnerWebsite").value.trim(),
      logoUrl,
      status: "published",
    };

    statusEl.textContent = "Saving…";
    if (editId) {
      await updateDoc(doc(db, "partners", editId), data);
    } else {
      await addDoc(collection(db, "partners"), { ...data, createdAt: serverTimestamp() });
    }
    statusEl.textContent = "Saved.";
    setTimeout(closeModal, 500);
  } catch (err) {
    console.error("Could not save partner:", err);
    statusEl.textContent = "⚠️ Could not save. Check console for details.";
  } finally {
    submitBtn.disabled = false;
  }
});

function buildCard(id, data) {
  const card = document.createElement("div");
  card.className = "content-card";
  card.innerHTML = `
    <div class="content-card-media partner-card-logo">
      ${data.logoUrl ? `<img src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.name || "")}" />` : `<strong style="font-size:1rem;">${escapeHtml(data.name || "—")}</strong>`}
    </div>
    <div class="content-card-body" style="gap:6px;">
      <h3 class="content-card-title" style="font-size:.95rem;">${escapeHtml(data.name || "Untitled")}</h3>
      ${data.websiteUrl ? `<p class="content-card-desc" style="font-size:.75rem;">${escapeHtml(data.websiteUrl)}</p>` : ""}
      <div class="content-card-footer">
        <button class="btn btn-outline btn-sm" data-edit>Edit</button>
        <button class="btn btn-danger-ghost btn-sm" data-remove>Remove</button>
      </div>
    </div>
  `;
  card.querySelector("[data-edit]").addEventListener("click", () => openModal(data, id));
  card.querySelector("[data-remove]").addEventListener("click", async () => {
    if (!confirm(`Remove ${data.name || "this partner"}?`)) return;
    try {
      await deleteDoc(doc(db, "partners", id));
    } catch (err) {
      console.error("Could not remove partner:", err);
      alert("Could not remove partner. Check console for details.");
    }
  });
  return card;
}

onSnapshot(query(collection(db, "partners"), orderBy("createdAt", "asc")), (snap) => {
  grid.innerHTML = "";
  if (snap.empty) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";
  snap.forEach((docSnap) => grid.appendChild(buildCard(docSnap.id, docSnap.data())));
});