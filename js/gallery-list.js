import { db, collection, query, orderBy, onSnapshot } from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const PAGE_SIZE = 9;
let currentPage = 1;
let allDocs = [];

const grid = document.getElementById("galleryListGrid");
const pagination = document.getElementById("galleryPagination");
const prevBtn = document.getElementById("galleryPrevBtn");
const nextBtn = document.getElementById("galleryNextBtn");
const pageLabel = document.getElementById("galleryPageLabel");
const lightbox = document.getElementById("lightbox");

function renderPage(page) {
  const totalPages = Math.max(1, Math.ceil(allDocs.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, page), totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageDocs = allDocs.slice(start, start + PAGE_SIZE);

  if (!pageDocs.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted,#64748b);">No gallery photos yet — check back soon.</div>`;
    pagination.style.display = "none";
    return;
  }

  grid.innerHTML = pageDocs.map((g) => `
    <div class="gallery-placeholder reveal-fade-up" role="listitem" style="cursor:zoom-in;" data-img="${escapeHtml(g.imageUrl)}" data-caption="${escapeHtml(g.caption || "")}">
      <img src="${escapeHtml(g.imageUrl)}" alt="${escapeHtml(g.caption || "")}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />
    </div>
  `).join("");

  grid.querySelectorAll(".gallery-placeholder").forEach((el) => {
    el.addEventListener("click", () => {
      document.getElementById("lightboxImg").src = el.dataset.img;
      document.getElementById("lightboxCaption").textContent = el.dataset.caption;
      lightbox.classList.add("open");
      lightbox.setAttribute("aria-hidden", "false");
    });
  });

  window.__observeReveals?.();

  pagination.style.display = totalPages > 1 ? "flex" : "none";
  pageLabel.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  window.scrollTo({ top: document.getElementById("gallery-list").offsetTop - 90, behavior: "smooth" });
}

if (grid) {
  const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"));

  onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => d.data()).filter((d) => d.status === "published");

      if (!docs.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted,#64748b);">No gallery photos yet — check back soon.</div>`;
        pagination.style.display = "none";
        return;
      }

      allDocs = docs;
      renderPage(1);
    },
    (err) => {
      console.error("gallery-list.js: onSnapshot error:", err);
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted,#64748b);">Could not load gallery. Please try again later.</div>`;
    }
  );
}

prevBtn?.addEventListener("click", () => renderPage(currentPage - 1));
nextBtn?.addEventListener("click", () => renderPage(currentPage + 1));