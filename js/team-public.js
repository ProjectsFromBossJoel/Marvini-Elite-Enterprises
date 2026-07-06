import { db, collection, onSnapshot } from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const grid = document.getElementById("teamGrid");
const bioModal = document.getElementById("bioModal");

function openBioModal(data) {
  document.getElementById("bioModalName").textContent = data.name || "";
  document.getElementById("bioModalRole").textContent = data.subsidiary || data.role || "";
  document.getElementById("bioModalText").innerHTML = data.fullBio || data.shortBio || "";
  document.getElementById("bioModalAvatar").src = data.photoUrl || "";
  document.getElementById("bioModalAvatar").alt = data.name || "";
  bioModal.classList.add("open");
  bioModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
}

if (grid) {
  onSnapshot(collection(db, "team"), (snap) => {
    const docs = snap.docs
      .map((d) => d.data())
      .filter((d) => d.status === "published" && d.category !== "Leadership");
    if (docs.length === 0) return; // keep existing hardcoded fallback cards

    grid.innerHTML = docs.map((m) => {
      const avatar = m.photoUrl && m.photoUrl.trim()
        ? m.photoUrl
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || "?")}&background=1a56ff&color=fff`;
      return `
        <div class="team-card reveal-fade-up revealed">
          <div class="team-card-inner">
            <div class="team-avatar-wrap">
              <div class="team-avatar-bg"></div>
              <img src="${escapeHtml(avatar)}" alt="${escapeHtml(m.name || "")}" class="team-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || "?")}&background=1a56ff&color=fff'" />
              <div class="team-avatar-ring"></div>
            </div>
            <div class="team-info">
              <div class="team-company-badge">
                <span class="team-badge-dot"></span>
                ${escapeHtml(m.subsidiary || "")}
              </div>
              <h3 class="team-name">${escapeHtml(m.name || "")}</h3>
              <p class="team-role">${escapeHtml(m.role || "")}</p>
              <p class="team-bio">${escapeHtml(m.shortBio || "")}</p>
              <button class="bio-readmore-live">
                Read More
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
              <div class="team-socials">
                ${m.linkedin ? `<a href="${escapeHtml(m.linkedin)}" target="_blank" rel="noopener noreferrer" class="team-social" aria-label="LinkedIn">in</a>` : ""}
                ${m.twitter ? `<a href="${escapeHtml(m.twitter)}" target="_blank" rel="noopener noreferrer" class="team-social" aria-label="Twitter">𝕏</a>` : ""}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Wire Read More buttons for the freshly-rendered cards
    grid.querySelectorAll(".bio-readmore-live").forEach((btn, i) => {
      btn.addEventListener("click", () => openBioModal(docs[i]));
    });
  });
}