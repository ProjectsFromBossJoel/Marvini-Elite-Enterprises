import { db, collection, query, where, orderBy, onSnapshot } from "./firebase-config.js";

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

if (grid) {
  const q = query(collection(db, "news"), where("status", "==", "published"), orderBy("publishedAt", "desc"));
  onSnapshot(q, (snap) => {
    if (snap.empty) {
      document.querySelectorAll(".news-skeleton").forEach((s) => s.remove());
      if (fallback) fallback.style.display = "block";
      return;
    }

    if (fallback) fallback.style.display = "none";
    grid.innerHTML = snap.docs.map((docSnap) => {
      const n = docSnap.data();
      const dateLabel = n.publishedAt?.toDate ? monthYearLabel(n.publishedAt.toDate()) : "";
      return `
        <article class="news-card reveal-fade-up revealed">
          <div class="news-img-wrap">
            <div class="news-img-placeholder" style="display:flex;align-items:center;justify-content:center;font-size:2.4rem;">${escapeHtml(n.emoji || "📰")}</div>
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
  });
}