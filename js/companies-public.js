import { db, collection, onSnapshot } from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const grid = document.getElementById("companiesGrid");
if (grid) {
  onSnapshot(collection(db, "companies"), (snap) => {
    const docs = snap.docs
      .map((d) => d.data())
      .filter((d) => d.status === "published");
    if (docs.length === 0) return; // keep existing hardcoded fallback cards

    docs.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    grid.innerHTML = docs.map((c) => `
      <div class="company-card reveal-fade-up revealed" data-company="${escapeHtml(c.name || "")}">
        <div class="company-card-glow" aria-hidden="true"></div>
        <div class="company-card-header">
          <div class="company-icon-wrap company-icon-wrap--logo" style="font-size:2rem; display:flex; align-items:center; justify-content:center;">${escapeHtml(c.icon || "🏢")}</div>
          <div class="company-tag">${escapeHtml(c.tag || "")}</div>
        </div>
        <div class="company-card-body">
          <h3 class="company-name">${escapeHtml(c.name || "")}</h3>
          <p class="company-desc">${escapeHtml(c.description || "")}</p>
        </div>
        <div class="company-card-footer">
          ${c.websiteUrl ? `<a href="${escapeHtml(c.websiteUrl)}" class="btn btn-outline btn-sm">Visit Website</a>` : `<a href="#" class="btn btn-outline btn-sm">Visit Website</a>`}
          ${c.learnMoreUrl ? `<a href="${escapeHtml(c.learnMoreUrl)}" class="btn btn-ghost-sm">Learn More →</a>` : `<a href="#" class="btn btn-ghost-sm">Learn More →</a>`}
        </div>
      </div>
    `).join("");
  });
}