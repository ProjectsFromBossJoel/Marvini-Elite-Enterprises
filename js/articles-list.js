// ══════════════════════════════════════════════════════════
// Public site — Articles & Publications full listing page
// Reuses the same card markup/classes as js/articles-public.js,
// paginated client-side over a single real-time Firestore query.
// ══════════════════════════════════════════════════════════
import {
  db,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  PUBLICATIONS_COLLECTION,
} from "./firebase-config.js";

const PAGE_SIZE = 9;
let currentPage = 1;
let allDocs = []; // [{ id, data }]

const grid = document.getElementById("articlesListGrid");
const pagination = document.getElementById("articlesPagination");
const prevBtn = document.getElementById("articlesPrevBtn");
const nextBtn = document.getElementById("articlesNextBtn");
const pageLabel = document.getElementById("articlesPageLabel");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function buildArticleCard(data, id) {
  const article = document.createElement("article");
  article.className = "article-card reveal-fade-up";

  const coverSrc = data.coverImageUrl || "img/articles/default-cover.jpg";
  const badgeLabel = (data.category || "pdf").toUpperCase();

  article.innerHTML = `
    <div class="article-cover">
      <img src="${coverSrc}" alt="${escapeHtml(data.title || "")}" class="article-cover-img" />
      <div class="article-cover-badge">${badgeLabel === "ARTICLE" || badgeLabel === "JOURNAL" || badgeLabel === "NEWS" ? "PDF" : badgeLabel}</div>
    </div>
    <div class="article-body">
      <h3 class="article-title">${escapeHtml(data.title || "Untitled")}</h3>
      <p class="article-desc">${escapeHtml(data.description || "")}</p>
      <a href="publication-details.html?id=${encodeURIComponent(id)}" class="article-readmore">
        Read More
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
      <a href="${data.fileUrl}" class="btn btn-primary btn-sm article-download" target="_blank" rel="noopener noreferrer" download>
        Download Now
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
    </div>
  `;

  return article;
}

function renderPage(page) {
  const totalPages = Math.max(1, Math.ceil(allDocs.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, page), totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = allDocs.slice(start, start + PAGE_SIZE);

  grid.innerHTML = "";

  if (!pageItems.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted,#64748b);">No publications available yet. Check back soon.</div>`;
    pagination.style.display = "none";
    return;
  }

  pageItems.forEach(({ id, data }) => {
    grid.appendChild(buildArticleCard(data, id));
  });
  window.__observeReveals?.();

  pagination.style.display = totalPages > 1 ? "flex" : "none";
  pageLabel.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  window.scrollTo({ top: document.getElementById("articles-list").offsetTop - 90, behavior: "smooth" });
}

if (grid) {
  const q = query(
    collection(db, PUBLICATIONS_COLLECTION),
    where("status", "==", "published"),
    orderBy("publishedAt", "desc")
  );

  onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted,#64748b);">No publications available yet. Check back soon.</div>`;
        pagination.style.display = "none";
        return;
      }

      allDocs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
      renderPage(1);
    },
    (err) => {
      console.error("articles-list.js: could not load publications:", err);
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted,#64748b);">Could not load publications. Please try again later.</div>`;
    }
  );
}

prevBtn?.addEventListener("click", () => renderPage(currentPage - 1));
nextBtn?.addEventListener("click", () => renderPage(currentPage + 1));