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

const grid = document.getElementById("newsGrid");
const fallback = document.getElementById("newsFallback");

function showFallback() {
  document.querySelectorAll(".news-skeleton").forEach((s) => s.remove());
  if (fallback) fallback.style.display = "block";
}

if (grid) {
  // NOTE: only a single where() clause — no orderBy — so this never needs
  // a Firestore composite index and never silently drops docs that are
  // missing a "publishedAt" field. Sorting happens client-side below.
  const q = query(collection(db, "news"), where("status", "==", "published"));

  onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        showFallback();
        return;
      }

      const docs = snap.docs.map((d) => d.data());
      docs.sort((a, b) => {
        const aTime = (a.publishedAt || a.createdAt)?.toMillis?.() || 0;
        const bTime = (b.publishedAt || b.createdAt)?.toMillis?.() || 0;
        return bTime - aTime;
      });

      if (fallback) fallback.style.display = "none";
      grid.innerHTML = docs.map((n) => {
        const ts = n.publishedAt || n.createdAt;
        const dateLabel = ts?.toDate ? monthYearLabel(ts.toDate()) : "";
        const mediaHtml = n.imageUrl
          ? `<img src="${escapeHtml(n.imageUrl)}" alt="${escapeHtml(n.title || "")}" style="width:100%; height:100%; object-fit:cover;" />`
          : `<div class="news-img-placeholder" style="display:flex;align-items:center;justify-content:center;font-size:2.4rem;">${escapeHtml(n.emoji || "📰")}</div>`;
        return `
          <article class="news-card reveal-fade-up revealed">
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
      }).join("");
    },
    (err) => {
      // Query failed (permissions, offline, etc.) — reveal the static
      // fallback instead of leaving skeletons stuck forever.
      console.error("news-public.js: onSnapshot error:", err);
      showFallback();
    }
  );
}