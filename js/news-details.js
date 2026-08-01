// js/news-details.js
// Public site — single News detail page (news-details.html?id=<docId>)
// Fetches one news doc from Firestore, renders it, and shows an
// "Explore More" sidebar of other recent published news posts.

import {
  db,
  doc,
  collection,
  where,
  query,
  onSnapshot,
  PUBLICATIONS_COLLECTION, // not used here, kept out intentionally
} from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function longDateLabel(date) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}
function shortDateLabel(date) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function setMetaTag(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

const params = new URLSearchParams(window.location.search);
const currentId = params.get("id");

const loadingEl = document.getElementById("newsDetailLoading");
const errorEl = document.getElementById("newsDetailError");
const gridEl = document.getElementById("newsDetailGrid");
const exploreListEl = document.getElementById("exploreMoreList");

function renderMainNews() {
  if (!currentId) {
    loadingEl.style.display = "none";
    errorEl.style.display = "block";
    return;
  }

  onSnapshot(
    doc(db, "news", currentId),
    (snap) => {
      if (!snap.exists() || snap.data().status !== "published") {
        loadingEl.style.display = "none";
        gridEl.style.display = "none";
        errorEl.style.display = "block";
        return;
      }

      const data = snap.data();
      const ts = data.publishedAt || data.createdAt;
      const dateLabel = ts?.toDate ? longDateLabel(ts.toDate()) : "";

      const pageTitle = `${data.title || "News"} | Marvini Elite Enterprises`;
      document.title = pageTitle;
      setMetaTag("name", "description", data.excerpt || "");
      setMetaTag("property", "og:title", pageTitle);
      setMetaTag("property", "og:description", data.excerpt || "");
      if (data.imageUrl) setMetaTag("property", "og:image", data.imageUrl);

      const coverImg = document.getElementById("newsDetailCoverImg");
      const emojiEl = document.getElementById("newsDetailEmoji");
      if (data.imageUrl) {
        coverImg.src = data.imageUrl;
        coverImg.alt = escapeHtml(data.title || "");
        coverImg.style.display = "block";
        emojiEl.style.display = "none";
      } else {
        coverImg.style.display = "none";
        emojiEl.style.display = "block";
        emojiEl.textContent = data.emoji || "📰";
      }

      document.getElementById("newsDetailTag").textContent = data.tag || "Update";
      document.getElementById("newsDetailTitle").textContent = data.title || "Untitled";
      document.getElementById("newsDetailMeta").textContent = dateLabel;
      document.getElementById("newsDetailBody").textContent = data.excerpt || "";

      loadingEl.style.display = "none";
      errorEl.style.display = "none";
      gridEl.style.display = "grid";
    },
    (err) => {
      console.error("Could not load news post:", err);
      loadingEl.style.display = "none";
      errorEl.style.display = "block";
    }
  );
}

function renderExploreMore() {
  if (!exploreListEl) return;

  const q = query(collection(db, "news"), where("status", "==", "published"));

  onSnapshot(
    q,
    (snap) => {
      let docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.id !== currentId);

      docs.sort((a, b) => {
        const aTime = (a.publishedAt || a.createdAt)?.toMillis?.() || 0;
        const bTime = (b.publishedAt || b.createdAt)?.toMillis?.() || 0;
        return bTime - aTime;
      });

      docs = docs.slice(0, 5);

      if (!docs.length) {
        exploreListEl.innerHTML = `<p class="explore-more-empty">No other news yet.</p>`;
        return;
      }

      exploreListEl.innerHTML = docs.map((n) => {
        const ts = n.publishedAt || n.createdAt;
        const dateLabel = ts?.toDate ? shortDateLabel(ts.toDate()) : "";
        const thumbHtml = n.imageUrl
          ? `<img src="${escapeHtml(n.imageUrl)}" alt="${escapeHtml(n.title || "")}" />`
          : `<span>${escapeHtml(n.emoji || "📰")}</span>`;
        return `
          <a href="news-details.html?id=${encodeURIComponent(n.id)}" class="explore-more-item">
            <div class="explore-more-thumb">${thumbHtml}</div>
            <span class="explore-more-tag">${escapeHtml(n.tag || "")}</span>
            <h4 class="explore-more-item-title">${escapeHtml(n.title || "")}</h4>
            <span class="explore-more-date">${dateLabel}</span>
          </a>
        `;
      }).join("");
    },
    (err) => {
      console.error("Could not load Explore More news:", err);
      exploreListEl.innerHTML = `<p class="explore-more-empty">Could not load related news.</p>`;
    }
  );
}

renderMainNews();
renderExploreMore();