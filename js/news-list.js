import { db, collection, where, query, onSnapshot } from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
function monthYearLabel(date) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const PAGE_SIZE = 9;
let currentPage = 1;
let allDocs = [];

const grid = document.getElementById("newsListGrid");
const pagination = document.getElementById("newsPagination");
const prevBtn = document.getElementById("newsPrevBtn");
const nextBtn = document.getElementById("newsNextBtn");
const pageLabel = document.getElementById("newsPageLabel");

function renderCard(n) {
  const ts = n.publishedAt || n.createdAt;
  const dateLabel = ts?.toDate ? monthYearLabel(ts.toDate()) : "";
  const mediaHtml = n.imageUrl
    ? `<img src="${escapeHtml(n.imageUrl)}" alt="${escapeHtml(n.title || "")}" style="width:100%; height:100%; object-fit:cover;" />`
    : `<div class="news-img-placeholder" style="display:flex;align-items:center;justify-content:center;font-size:2.4rem;">${escapeHtml(n.emoji || "📰")}</div>`;
  return `
    <article class="news-card reveal-fade-up">
      <div class="news-img-wrap">
        ${mediaHtml}
      </div>
      <div class="news-body">
        <span class="news-tag">${escapeHtml(n.tag || "")}</span>
        <h3 class="news-title">${escapeHtml(n.title || "")}</h3>
        <p class="news-excerpt">${escapeHtml(n.excerpt || "")}</p>
        <div class="news-meta">
          <time class="news-date">${dateLabel}</time>
        </div>
      </div>
    </article>
  `;
}

function renderPage(page) {
  const totalPages = Math.max(1, Math.ceil(allDocs.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, page), totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageDocs = allDocs.slice(start, start + PAGE_SIZE);

  if (!pageDocs.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted,#64748b);">No news yet — check back soon.</div>`;
    pagination.style.display = "none";
    return;
  }

  grid.innerHTML = pageDocs.map(renderCard).join("");
  window.__observeReveals?.();

  pagination.style.display = totalPages > 1 ? "flex" : "none";
  pageLabel.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  window.scrollTo({ top: document.getElementById("news-list").offsetTop - 90, behavior: "smooth" });
}

if (grid) {
  const q = query(collection(db, "news"), where("status", "==", "published"));

  onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted,#64748b);">No news yet — check back soon.</div>`;
        pagination.style.display = "none";
        return;
      }

      allDocs = snap.docs.map((d) => d.data());
      allDocs.sort((a, b) => {
        const aTime = (a.publishedAt || a.createdAt)?.toMillis?.() || 0;
        const bTime = (b.publishedAt || b.createdAt)?.toMillis?.() || 0;
        return bTime - aTime;
      });

      renderPage(1);
    },
    (err) => {
      console.error("news-list.js: onSnapshot error:", err);
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted,#64748b);">Could not load news. Please try again later.</div>`;
    }
  );
}

prevBtn?.addEventListener("click", () => renderPage(currentPage - 1));
nextBtn?.addEventListener("click", () => renderPage(currentPage + 1));