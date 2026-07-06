import { db, collection, query, orderBy, onSnapshot } from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const grid = document.getElementById("galleryGrid");
const lightbox = document.getElementById("lightbox");

if (grid) {
  const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => d.data()).filter((d) => d.status === "published");
    if (docs.length === 0) return; // keep existing emoji placeholders

    grid.innerHTML = docs.map((g) => `
      <div class="gallery-placeholder reveal-fade-up revealed" role="listitem" style="cursor:zoom-in;" data-img="${escapeHtml(g.imageUrl)}" data-caption="${escapeHtml(g.caption || "")}">
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
  });
}