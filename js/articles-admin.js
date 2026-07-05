// ══════════════════════════════════════════════════════════
// Articles & Reports — Admin logic
// ══════════════════════════════════════════════════════════
import { uploadToCloudinary } from "./cloudinary.js";
import {
  db,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
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
      loadPublications();
    }, 600);
  } catch (err) {
    console.error(err);
    uploadStatus.textContent = "Something went wrong: " + err.message;
  } finally {
    uploadSubmitBtn.disabled = false;
  }
});

// ── Load & render publications ───────────────────────────
async function loadPublications() {
  tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Loading…</td></tr>`;

  const q = query(collection(db, PUBLICATIONS_COLLECTION), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

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
        <div><strong>${escapeHtml(data.title || "Untitled")}</strong><span>${escapeHtml(data.description || "")}</span></div>
      </div>
    </td>
    <td>${categoryLabel}</td>
    <td>${data.fileName || "—"}</td>
    <td>${data.downloads || 0} downloads</td>
    <td><span class="pill ${isPublished ? "completed" : "pending"}">${isPublished ? "Published" : "Draft"}</span></td>
    <td>
      <div class="row-actions">
        <button aria-label="Read" data-action="read" title="Open PDF">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button aria-label="${isPublished ? "Unpublish" : "Publish"}" data-action="toggle-publish" title="${isPublished ? "Unpublish" : "Publish"}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${isPublished ? '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>' : '<path d="M5 12h14M12 5l7 7-7 7"/>'}</svg>
        </button>
        <button aria-label="Remove" class="danger" data-action="delete" data-confirm-remove>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </td>
  `;

  tr.querySelector('[data-action="read"]').addEventListener("click", () => {
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

  loadPublications();
}

// ── Delete ────────────────────────────────────────────────
async function deleteItem(id, title) {
  const confirmed = window.confirm(`Remove "${title || "this publication"}"? This cannot be undone.`);
  if (!confirmed) return;

  await deleteDoc(doc(db, PUBLICATIONS_COLLECTION, id));
  loadPublications();

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