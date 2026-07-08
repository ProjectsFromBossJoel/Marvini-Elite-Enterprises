// js/news-admin.js
// Admin: create/edit/delete News & Updates posts (dashboard/news.html).
// Public site reads the same "news" collection where status == "published".

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

const grid = document.getElementById("newsAdminGrid");
const emptyState = document.getElementById("newsEmptyState");
const modal = document.getElementById("newsModal");
const form = document.getElementById("newsForm");
const modalTitle = document.getElementById("newsModalTitle");
const statusEl = document.getElementById("newsStatus");
const submitBtn = document.getElementById("newsSubmitBtn");
const imageFileInput = document.getElementById("newsImageFile");
const imagePreviewWrap = document.getElementById("newsImagePreviewWrap");
const imagePreview = document.getElementById("newsImagePreview");
const imageRemoveBtn = document.getElementById("newsImageRemoveBtn");

// ── Cloudinary config ───────────────────────────────────
// Unsigned upload preset created in the Cloudinary console, scoped to
// the marvini/news folder (mirrors the marvini/gallery pattern already in use).
const CLOUDINARY_CLOUD_NAME = "dilb7jd6w";
const CLOUDINARY_UPLOAD_PRESET = "marvini_news_unsigned";

let currentImageUrl = ""; // tracks the image currently attached to the form
let pendingRemoveImage = false;

async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "marvini/news");

  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const json = await res.json();
  return json.secure_url;
}

function showImagePreview(url) {
  if (!url) {
    imagePreviewWrap.style.display = "none";
    imagePreview.src = "";
    return;
  }
  imagePreview.src = url;
  imagePreviewWrap.style.display = "block";
}

imageFileInput?.addEventListener("change", () => {
  const file = imageFileInput.files?.[0];
  if (!file) return;
  pendingRemoveImage = false;
  showImagePreview(URL.createObjectURL(file));
});

imageRemoveBtn?.addEventListener("click", () => {
  imageFileInput.value = "";
  currentImageUrl = "";
  pendingRemoveImage = true;
  showImagePreview("");
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function monthYearLabel(date) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ── Open / close modal ──────────────────────────────────
function openModal(editData = null, editId = null) {
  form.reset();
  document.getElementById("newsDocId").value = editId || "";
  imageFileInput.value = "";
  pendingRemoveImage = false;

  if (editData) {
    modalTitle.textContent = "Edit Post";
    document.getElementById("newsTitle").value = editData.title || "";
    document.getElementById("newsTag").value = editData.tag || "";
    document.getElementById("newsExcerpt").value = editData.excerpt || "";
    document.getElementById("newsEmoji").value = editData.emoji || "";
    document.getElementById("newsPublishNow").checked = editData.status === "published";
    currentImageUrl = editData.imageUrl || "";
    showImagePreview(currentImageUrl);
  } else {
    modalTitle.textContent = "New Post";
    document.getElementById("newsPublishNow").checked = true;
    currentImageUrl = "";
    showImagePreview("");
  }
  statusEl.textContent = "";
  modal.classList.add("open");
}
function closeModal() {
  modal.classList.remove("open");
}

document.getElementById("openNewsBtn")?.addEventListener("click", () => openModal());
document.getElementById("closeNewsBtn")?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

// ── Submit (create or update) ───────────────────────────
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  statusEl.textContent = "Saving…";

  const editId = document.getElementById("newsDocId").value;
  const publishNow = document.getElementById("newsPublishNow").checked;
  const newFile = imageFileInput.files?.[0] || null;

  let imageUrl = currentImageUrl;

  try {
    if (newFile) {
      statusEl.textContent = "Uploading image…";
      imageUrl = await uploadToCloudinary(newFile);
    } else if (pendingRemoveImage) {
      imageUrl = "";
    }

    statusEl.textContent = "Saving…";

    const data = {
      title: document.getElementById("newsTitle").value.trim(),
      tag: document.getElementById("newsTag").value.trim(),
      excerpt: document.getElementById("newsExcerpt").value.trim(),
      emoji: document.getElementById("newsEmoji").value.trim() || "📰",
      imageUrl: imageUrl || "",
      status: publishNow ? "published" : "draft",
    };

    if (editId) {
      await updateDoc(doc(db, "news", editId), data);
    } else {
      await addDoc(collection(db, "news"), {
        ...data,
        createdAt: serverTimestamp(),
        publishedAt: publishNow ? serverTimestamp() : null,
      });
    }
    statusEl.textContent = "Saved.";
    setTimeout(closeModal, 500);
  } catch (err) {
    console.error("Could not save post:", err);
    statusEl.textContent = "⚠️ Could not save. Check console for details.";
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Render list (live) ──────────────────────────────────
function buildCard(id, data) {
  const card = document.createElement("div");
  card.className = "content-card";
  const dateLabel = data.publishedAt?.toDate
    ? monthYearLabel(data.publishedAt.toDate())
    : data.createdAt?.toDate
    ? monthYearLabel(data.createdAt.toDate())
    : "";

  const mediaHtml = data.imageUrl
    ? `<img src="${escapeHtml(data.imageUrl)}" alt="${escapeHtml(data.title || "")}" style="width:100%; height:100%; object-fit:cover;" />`
    : escapeHtml(data.emoji || "📰");

  card.innerHTML = `
    <div class="content-card-media">${mediaHtml}<span class="cc-badge">${data.status === "published" ? "Published" : "Draft"}</span></div>
    <div class="content-card-body">
      <span class="content-card-tag">${escapeHtml(data.tag || "")}${dateLabel ? " · " + dateLabel : ""}</span>
      <h3 class="content-card-title">${escapeHtml(data.title || "Untitled")}</h3>
      <p class="content-card-desc">${escapeHtml(data.excerpt || "")}</p>
      <div class="content-card-footer">
        <button class="btn btn-outline btn-sm" data-edit>Edit</button>
        <button class="btn btn-danger-ghost btn-sm" data-remove>Remove</button>
      </div>
    </div>
  `;

  card.querySelector("[data-edit]").addEventListener("click", () => openModal(data, id));
  card.querySelector("[data-remove]").addEventListener("click", async () => {
    const confirmed = await uiConfirm("Remove this post? This cannot be undone.", {
      title: "Remove Post", confirmText: "Remove", danger: true
    });
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, "news", id));
    } catch (err) {
      console.error("Could not remove post:", err);
      await uiAlert("Could not remove post. Check console for details.", { title: "Error", danger: true });
    }
  });

  return card;
}

onSnapshot(query(collection(db, "news"), orderBy("createdAt", "desc")), (snap) => {
  grid.innerHTML = "";
  if (snap.empty) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";
  snap.forEach((docSnap) => {
    grid.appendChild(buildCard(docSnap.id, docSnap.data()));
  });
});