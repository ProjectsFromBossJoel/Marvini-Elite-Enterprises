// js/publication-details.js
// Public site — single Publication detail page (publication-details.html?id=<docId>)
// Fetches one publication doc from Firestore and renders full content + download.

import {
  db,
  doc,
  onSnapshot,
  PUBLICATIONS_COLLECTION,
} from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatDate(timestamp) {
  if (!timestamp?.toDate) return "";
  return timestamp.toDate().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function renderPublicationDetail() {
  const loadingEl = document.getElementById("pubDetailLoading");
  const errorEl = document.getElementById("pubDetailError");
  const gridEl = document.getElementById("pubDetailGrid");

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    loadingEl.style.display = "none";
    errorEl.style.display = "block";
    return;
  }

  // Real-time listener: if this publication is edited or unpublished in
  // the admin dashboard while someone is viewing it, the page updates
  // live (or shows the "not found" state) without a refresh.
  onSnapshot(
    doc(db, PUBLICATIONS_COLLECTION, id),
    (snap) => {
      if (!snap.exists() || snap.data().status !== "published") {
        loadingEl.style.display = "none";
        gridEl.style.display = "none";
        errorEl.style.display = "block";
        return;
      }

      const data = snap.data();

      document.title = `${data.title || "Publication"} | Marvini Elite Enterprises`;

      const coverSrc = data.coverImageUrl || "img/articles/default-cover.jpg";
      document.getElementById("pubDetailCoverImg").src = coverSrc;
      document.getElementById("pubDetailCoverImg").alt = escapeHtml(data.title || "");

      document.getElementById("pubDetailBadge").textContent = (data.category || "pdf").toUpperCase();
      document.getElementById("pubDetailTitle").textContent = data.title || "Untitled";

      const metaParts = [];
      const dateStr = formatDate(data.publishedAt) || formatDate(data.createdAt);
      if (dateStr) metaParts.push(dateStr);
      if (data.category) metaParts.push(data.category.charAt(0).toUpperCase() + data.category.slice(1));
      document.getElementById("pubDetailMeta").textContent = metaParts.join(" · ");

      document.getElementById("pubDetailBody").textContent = data.description || "";

      const downloadBtn = document.getElementById("pubDetailDownload");
      downloadBtn.href = data.fileUrl || "#";
      if (data.fileName) downloadBtn.setAttribute("download", data.fileName);

      errorEl.style.display = "none";
      loadingEl.style.display = "none";
      gridEl.style.display = "grid";
    },
    (err) => {
      console.error("Could not load publication:", err);
      loadingEl.style.display = "none";
      errorEl.style.display = "block";
    }
  );
}

renderPublicationDetail();