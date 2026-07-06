// js/gallery-admin.js
// Admin: upload/remove Gallery photos (dashboard/gallery.html).
// Public site (index.html #galleryGrid) reads the same "gallery" collection.

import {
  db,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "./firebase-config.js";
import { uploadToCloudinary } from "./cloudinary.js";

const grid = document.getElementById("galleryAdminGrid");
const emptyState = document.getElementById("galleryEmptyState");
const modal = document.getElementById("galleryModal");
const form = document.getElementById("galleryForm");
const statusEl = document.getElementById("galleryStatus");
const submitBtn = document.getElementById("gallerySubmitBtn");

const galleryFile = document.getElementById("galleryFile");
const galleryFileName = document.getElementById("galleryFileName");
const galleryPreviewWrap = document.getElementById("galleryPreviewWrap");
const galleryPreview = document.getElementById("galleryPreview");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const CATEGORY_LABELS = {
  msmart: "M-Smart Driving School",
  mfood: "M-Digital Food Chain",
  mevents: "M-Events & Festivals",
  mfarms: "M-Farms",
  community: "Community Impact",
  "": "General",
};

// ── File picker ──────────────────────────────────────────
document.getElementById("galleryFileLabel")?.addEventListener("click", (e) => {
  if (e.target !== galleryFile) galleryFile.click();
});
galleryFile?.addEventListener("change", () => {
  const file = galleryFile.files[0];
  if (!file) return;
  galleryFileName.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    galleryPreview.src = ev.target.result;
    galleryPreviewWrap.style.display = "block";
  };
  reader.readAsDataURL(file);
});

// ── Open / close modal ───────────────────────────────────
function openModal() {
  form.reset();
  galleryFileName.textContent = "Choose an image…";
  galleryPreviewWrap.style.display = "none";
  document.getElementById("galleryUploadProgress").style.display = "none";
  document.getElementById("galleryUploadProgressBar").style.width = "0%";
  statusEl.textContent = "";
  modal.classList.add("open");
}
function closeModal() {
  modal.classList.remove("open");
}
document.getElementById("openGalleryBtn")?.addEventListener("click", openModal);
document.getElementById("closeGalleryBtn")?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

// ── Submit (upload + create) ─────────────────────────────
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = galleryFile.files[0];
  if (!file) {
    statusEl.textContent = "Please choose an image.";
    return;
  }

  submitBtn.disabled = true;
  statusEl.textContent = "Uploading photo…";

  try {
    const progressWrap = document.getElementById("galleryUploadProgress");
    progressWrap.style.display = "block";
    const result = await uploadToCloudinary(file, "image", "marvini/gallery", "marvini_gallery");

    statusEl.textContent = "Saving…";
    await addDoc(collection(db, "gallery"), {
      caption: document.getElementById("galleryCaption").value.trim(),
      category: document.getElementById("galleryCategory").value,
      imageUrl: result.url,
      imagePublicId: result.publicId,
      status: "published",
      createdAt: serverTimestamp(),
    });

    statusEl.textContent = "Saved.";
    setTimeout(closeModal, 500);
  } catch (err) {
    console.error("Could not save photo:", err);
    statusEl.textContent = "⚠️ Could not save. Check console for details.";
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Render ────────────────────────────────────────────────
function buildCard(id, data) {
  const card = document.createElement("div");
  card.className = "content-card";
  card.innerHTML = `
    <div class="content-card-media" style="height:170px; padding:0; overflow:hidden;">
      <img src="${escapeHtml(data.imageUrl)}" alt="${escapeHtml(data.caption || "")}" style="width:100%;height:100%;object-fit:cover;" />
    </div>
    <div class="content-card-body" style="gap:6px;">
      <span class="content-card-tag">${escapeHtml(CATEGORY_LABELS[data.category] || "General")}</span>
      <h3 class="content-card-title" style="font-size:.92rem;">${escapeHtml(data.caption || "Untitled")}</h3>
      <div class="content-card-footer">
        <button class="btn btn-danger-ghost btn-sm" data-remove style="flex:1; justify-content:center;">Remove</button>
      </div>
    </div>
  `;
  card.querySelector("[data-remove]").addEventListener("click", async () => {
    if (!confirm("Remove this photo? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "gallery", id));
    } catch (err) {
      console.error("Could not remove photo:", err);
      alert("Could not remove photo. Check console for details.");
    }
  });
  return card;
}

onSnapshot(query(collection(db, "gallery"), orderBy("createdAt", "desc")), (snap) => {
  grid.innerHTML = "";
  if (snap.empty) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";
  snap.forEach((docSnap) => grid.appendChild(buildCard(docSnap.id, docSnap.data())));
});