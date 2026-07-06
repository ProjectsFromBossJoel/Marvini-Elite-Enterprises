import { db, collection, query, orderBy, onSnapshot } from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const carousel = document.getElementById("partnersCarousel");

if (carousel) {
  const q = query(collection(db, "partners"), orderBy("createdAt", "asc"));
  onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => d.data()).filter((d) => d.status === "published");
    if (docs.length === 0) return; // keep existing static list

    const itemsHtml = docs.map((p) => {
      return p.logoUrl
        ? `<div class="partner-logo" aria-label="${escapeHtml(p.name || "")}"><img src="${escapeHtml(p.logoUrl)}" alt="${escapeHtml(p.name || "")}" style="max-height:36px;max-width:100%;object-fit:contain;" /></div>`
        : `<div class="partner-logo" aria-label="${escapeHtml(p.name || "")}">${escapeHtml(p.name || "")}</div>`;
    }).join("");

    // Duplicate once for the existing infinite-scroll CSS animation
    carousel.innerHTML = itemsHtml + itemsHtml;
  });
}