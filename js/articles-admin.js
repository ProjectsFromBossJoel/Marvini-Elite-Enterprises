// ══════════════════════════════════════════════════════════
// Articles & Reports — Admin logic
// ══════════════════════════════════════════════════════════
import { uploadToCloudinary } from "./cloudinary.js";
import {
  db,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  onSnapshot,
  serverTimestamp,
  PUBLICATIONS_COLLECTION,
} from "./firebase-config.js";

const tableBody = document.getElementById("pubTableBody");
const emptyState = document.getElementById("pubEmptyState");

const uploadModal = document.getElementById("uploadModal");
const openUploadBtn = document.getElementById("openUploadBtn");
const closeUploadBtn = document.getElementById("closeUploadBtn");
const uploadForm = document.getElementById("uploadForm");
const uploadSubmitBtn = document.getElementById("uploadSubmitBtn");
const uploadStatus = document.getElementById("uploadStatus");

const viewModal = document.getElementById("viewModal");
const closeViewBtn = document.getElementById("closeViewBtn");
const viewCoverWrap = document.getElementById("viewCoverWrap");
const viewTitle = document.getElementById("viewTitle");
const viewDescription = document.getElementById("viewDescription");
const viewCategoryPill = document.getElementById("viewCategoryPill");
const viewDownloadBtn = document.getElementById("viewDownloadBtn");
const viewEditBtn = document.getElementById("viewEditBtn");

const editModal = document.getElementById("editModal");
const closeEditBtn = document.getElementById("closeEditBtn");
const editForm = document.getElementById("editForm");
const editSubmitBtn = document.getElementById("editSubmitBtn");
const editStatus = document.getElementById("editStatus");

let currentViewId = null;
let currentViewData = null;

// ── Modal open/close ─────────────────────────────────────
openUploadBtn?.addEventListener("click", () => {
  uploadModal.classList.add("open");
});
closeUploadBtn?.addEventListener("click", closeModal);
uploadModal?.addEventListener("click", (e) => {
  if (e.target === uploadModal) closeModal();
});
function closeModal() {
  uploadModal.classList.remove("open");
  uploadForm.reset();
  uploadStatus.textContent = "";
}

// ── View modal ────────────────────────────────────────────
function openViewModal(id, data) {
  currentViewId = id;
  currentViewData = data;

  viewTitle.textContent = data.title || "Untitled";
  viewDescription.textContent = data.description || "No description provided.";
  const categoryLabel = (data.category || "article").charAt(0).toUpperCase() + (data.category || "article").slice(1);
  viewCategoryPill.textContent = categoryLabel;
  viewCategoryPill.className = `pill ${data.status === "published" ? "completed" : "pending"}`;

  viewCoverWrap.innerHTML = data.coverImageUrl
    ? `<img src="${data.coverImageUrl}" alt="" />`
    : `<div class="view-cover empty">No cover image</div>`;

  viewDownloadBtn.onclick = () => {
    if (data.fileUrl) window.open(data.fileUrl, "_blank");
  };

  viewModal.classList.add("open");
}
closeViewBtn?.addEventListener("click", closeViewModal);
viewModal?.addEventListener("click", (e) => {
  if (e.target === viewModal) closeViewModal();
});
function closeViewModal() {
  viewModal.classList.remove("open");
}

viewEditBtn?.addEventListener("click", () => {
  if (!currentViewId || !currentViewData) return;
  closeViewModal();
  openEditModal(currentViewId, currentViewData);
});

// ── Edit modal ────────────────────────────────────────────
function openEditModal(id, data) {
  editForm.dataset.id = id;
  document.getElementById("editTitle").value = data.title || "";
  document.getElementById("editDescription").value = data.description || "";
  document.getElementById("editCategory").value = data.category || "article";
  document.getElementById("editCover").value = "";
  document.getElementById("editPdf").value = "";
  editStatus.textContent = "";
  editModal.classList.add("open");
}
closeEditBtn?.addEventListener("click", closeEditModal);
editModal?.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});
function closeEditModal() {
  editModal.classList.remove("open");
  editForm.reset();
  editStatus.textContent = "";
}

editForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = editForm.dataset.id;
  if (!id) return;

  const title = document.getElementById("editTitle").value.trim();
  const description = document.getElementById("editDescription").value.trim();
  const category = document.getElementById("editCategory").value;
  const newCoverFile = document.getElementById("editCover").files[0];
  const newPdfFile = document.getElementById("editPdf").files[0];

  if (!title || !category) {
    editStatus.textContent = "Please fill in the title and type.";
    return;
  }

  editSubmitBtn.disabled = true;
  editStatus.textContent = "Saving…";

  try {
    const updates = { title, description, category };

    if (newCoverFile) {
      editStatus.textContent = "Uploading new cover image…";
      const coverResult = await uploadToCloudinary(newCoverFile, "image", "marvini-publications/covers");
      updates.coverImageUrl = coverResult.url;
      updates.coverPublicId = coverResult.publicId;
    }

    if (newPdfFile) {
      editStatus.textContent = "Uploading new PDF…";
      const pdfResult = await uploadToCloudinary(newPdfFile, "raw", "marvini-publications/pdfs");
      updates.fileUrl = pdfResult.url;
      updates.filePublicId = pdfResult.publicId;
      updates.fileName = newPdfFile.name;
    }

    editStatus.textContent = "Saving to database…";
    await updateDoc(doc(db, PUBLICATIONS_COLLECTION, id), updates);

    editStatus.textContent = "Saved successfully.";
    setTimeout(() => {
      closeEditModal();
    }, 600);
  } catch (err) {
    console.error(err);
    editStatus.textContent = "Something went wrong: " + err.message;
  } finally {
    editSubmitBtn.disabled = false;
  }
});

// ── Create a new publication ─────────────────────────────
uploadForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("pubTitle").value.trim();
  const description = document.getElementById("pubDescription").value.trim();
  const category = document.getElementById("pubCategory").value;
  const pdfFile = document.getElementById("pubPdf").files[0];
  const coverFile = document.getElementById("pubCover").files[0];

  if (!title || !category || !pdfFile) {
    uploadStatus.textContent = "Please fill in the title, category, and choose a PDF file.";
    return;
  }

  uploadSubmitBtn.disabled = true;
  uploadStatus.textContent = "Uploading PDF…";

  try {
    const pdfResult = await uploadToCloudinary(pdfFile, "raw", "marvini-publications/pdfs");

    let coverResult = null;
    if (coverFile) {
      uploadStatus.textContent = "Uploading cover image…";
      coverResult = await uploadToCloudinary(coverFile, "image", "marvini-publications/covers");
    }

    uploadStatus.textContent = "Saving to database…";

    await addDoc(collection(db, PUBLICATIONS_COLLECTION), {
      title,
      description,
      category, // "article" | "journal" | "news"
      fileUrl: pdfResult.url,
      filePublicId: pdfResult.publicId,
      fileName: pdfFile.name,
      coverImageUrl: coverResult ? coverResult.url : null,
      coverPublicId: coverResult ? coverResult.publicId : null,
      status: "draft", // draft | published
      downloads: 0,
      createdAt: serverTimestamp(),
      publishedAt: null,
    });

    uploadStatus.textContent = "Uploaded successfully.";
    setTimeout(() => {
      closeModal();
    }, 600);
  } catch (err) {
    console.error(err);
    uploadStatus.textContent = "Something went wrong: " + err.message;
  } finally {
    uploadSubmitBtn.disabled = false;
  }
});

// ── Load & render publications (real-time) ───────────────
function loadPublications() {
  tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Loading…</td></tr>`;

  const q = query(collection(db, PUBLICATIONS_COLLECTION), orderBy("createdAt", "desc"));

  // Real-time listener: the table reflects new uploads, edits, publish
  // toggles, and deletes instantly — including changes made from another
  // browser tab or by another admin — with no manual refresh needed.
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      tableBody.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";
    tableBody.innerHTML = "";

    snapshot.forEach((docSnap) => {
      tableBody.appendChild(renderRow(docSnap.id, docSnap.data()));
    });
  });
}

function renderRow(id, data) {
  const tr = document.createElement("tr");
  tr.dataset.id = id;

  const isPublished = data.status === "published";
  const categoryLabel = (data.category || "article").charAt(0).toUpperCase() + (data.category || "article").slice(1);

  tr.innerHTML = `
    <td>
      <div class="student-cell">
        <div style="width:32px;height:32px;border-radius:8px;background:var(--bg-glass);display:flex;align-items:center;justify-content:center;font-size:.9rem;overflow:hidden;">
          ${data.coverImageUrl ? `<img src="${data.coverImageUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" />` : "📄"}
        </div>
        <div><strong>${escapeHtml(data.title || "Untitled")}</strong><span class="row-sub-trunc" title="${escapeHtml(data.description || "")}">${escapeHtml(data.description || "")}</span></div>
      </div>
    </td>
    <td>${categoryLabel}</td>
    <td>${data.fileName || "—"}</td>
    <td>${data.downloads || 0} downloads</td>
    <td><span class="pill ${isPublished ? "completed" : "pending"}">${isPublished ? "Published" : "Draft"}</span></td>
    <td>
      <div class="row-actions">
        <button aria-label="View" data-action="view" title="View details">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button aria-label="Download" data-action="download" title="Download PDF">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 19h16"/></svg>
        </button>
        <button aria-label="${isPublished ? "Unpublish" : "Publish"}" data-action="toggle-publish" title="${isPublished ? "Unpublish" : "Publish"}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${isPublished ? '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>' : '<path d="M5 12h14M12 5l7 7-7 7"/>'}</svg>
        </button>
        <button aria-label="Remove" title="Remove" class="danger" data-action="delete" data-confirm-remove>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </td>
  `;

  tr.querySelector('[data-action="view"]').addEventListener("click", () => openViewModal(id, data));
  tr.querySelector('[data-action="download"]').addEventListener("click", () => {
    if (data.fileUrl) window.open(data.fileUrl, "_blank");
  });
  tr.querySelector('[data-action="toggle-publish"]').addEventListener("click", () => togglePublish(id, data.status));
  tr.querySelector('[data-action="delete"]').addEventListener("click", () => deleteItem(id, data.title));

  return tr;
}

// ── Publish / Unpublish ──────────────────────────────────
async function togglePublish(id, currentStatus) {
  const nextStatus = currentStatus === "published" ? "draft" : "published";
  const ref = doc(db, PUBLICATIONS_COLLECTION, id);

  await updateDoc(ref, {
    status: nextStatus,
    publishedAt: nextStatus === "published" ? serverTimestamp() : null,
  });
}

// ── Delete ────────────────────────────────────────────────
async function deleteItem(id, title) {
  const confirmed = await uiConfirm(`Remove "${title || "this publication"}"? This cannot be undone.`, {
    title: "Remove Publication", confirmText: "Remove", danger: true
  });
  if (!confirmed) return;

  await deleteDoc(doc(db, PUBLICATIONS_COLLECTION, id));

  // Note: this removes the Firestore record (and therefore the listing
  // on both the admin dashboard and the public site). The underlying
  // Cloudinary file is NOT deleted automatically — unsigned uploads
  // cannot be safely destroyed from client-side code. If you need
  // automatic Cloudinary cleanup, add a small server function (e.g.
  // a Firebase Cloud Function) that calls Cloudinary's authenticated
  // destroy API using your API secret.
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Init ──────────────────────────────────────────────────
loadPublications();