//team-public.js
import { db, collection, onSnapshot } from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Same ordering rule as the admin table: explicit "order" ascending,
// unordered members fall back to createdAt (oldest first).
function compareTeamDocs(a, b) {
  const ao = typeof a.order === "number" ? a.order : Infinity;
  const bo = typeof b.order === "number" ? b.order : Infinity;
  if (ao !== bo) return ao - bo;
  const at = a.createdAt?.seconds ?? 0;
  const bt = b.createdAt?.seconds ?? 0;
  return at - bt;
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

// ── Featured horizontal profile cards (top of Team section) ──
const featuredGrid = document.getElementById("featuredTeamGrid");
function renderFeaturedCards(allDocs) {
  if (!featuredGrid) return;
  const featured = allDocs
    .filter((d) => d.status === "published" && d.showAsFeatured)
    .sort(compareTeamDocs);
  if (featured.length === 0) return; // keep existing hardcoded fallback cards

  featuredGrid.innerHTML = featured.map((m, i) => {
    const avatar = m.photoUrl && m.photoUrl.trim()
      ? m.photoUrl
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || "?")}&background=1a56ff&color=fff`;
    const orange = i % 2 === 1;
    return `
      <div class="featured-profile-card reveal-fade-up revealed">
        <div class="featured-avatar-wrap">
          <div class="featured-avatar-glow${orange ? " featured-avatar-glow--orange" : ""}"></div>
          <div class="featured-avatar-ring${orange ? " featured-avatar-ring--orange" : ""}"></div>
          <img src="${escapeHtml(avatar)}" alt="${escapeHtml(m.name || "")}" class="featured-avatar${orange ? " featured-avatar--orange" : ""}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || "?")}&background=1a56ff&color=fff'" />
        </div>
        <div class="featured-info">
          <div class="team-company-badge">
            <span class="team-badge-dot"></span>
            ${escapeHtml(m.subsidiary || "")}
          </div>
          <h3 class="featured-name">${escapeHtml(m.name || "")}</h3>
          <p class="featured-role">${escapeHtml(m.role || "")}</p>
          <p class="featured-bio">${escapeHtml(m.shortBio || "")}</p>
          <button class="bio-readmore-live">
            <span class="bio-readmore-text">Read More</span>
            <span class="bio-readmore-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
          </button>
          <div class="team-socials">
            ${m.linkedin ? `<a href="${escapeHtml(m.linkedin)}" target="_blank" rel="noopener noreferrer" class="team-social" aria-label="LinkedIn">in</a>` : ""}
            ${m.twitter ? `<a href="${escapeHtml(m.twitter)}" target="_blank" rel="noopener noreferrer" class="team-social" aria-label="Twitter">𝕏</a>` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");

  featuredGrid.querySelectorAll(".bio-readmore-live").forEach((btn, i) => {
    btn.addEventListener("click", () => openBioModal(featured[i]));
  });
}

// ── About-section Leadership Message (CEO quote card) ───
function renderLeadershipMessage(allDocs) {
  const photoEl = document.getElementById("ceoQuotePhoto");
  const quoteEl = document.getElementById("ceoQuoteText");
  const nameEl = document.getElementById("ceoQuoteName");
  const titleEl = document.getElementById("ceoQuoteTitle");
  if (!quoteEl) return; // ids not present on this page

  const leader = allDocs.find(
    (d) => d.status === "published" && d.showAsLeadershipMessage && d.leadershipQuote
  );
  if (!leader) return; // keep existing hardcoded fallback quote

  if (photoEl && leader.photoUrl) photoEl.src = leader.photoUrl;
  if (nameEl) nameEl.textContent = leader.name || "";
  if (titleEl) titleEl.textContent = leader.subsidiary ? `${leader.role}, ${leader.subsidiary}` : (leader.role || "");
  quoteEl.style.whiteSpace = "pre-line";
  quoteEl.textContent = leader.leadershipQuote;
}

if (grid) {
  onSnapshot(collection(db, "team"), (snap) => {
    const allDocs = snap.docs.map((d) => d.data());
    renderLeadershipMessage(allDocs);
    renderFeaturedCards(allDocs);

    const docs = allDocs
      .filter((d) => d.status === "published" && d.category !== "Leadership" && !d.showAsFeatured)
      .sort(compareTeamDocs);
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
              ${m.subsidiaryLogoUrl ? `<span class="team-avatar-badge-link" aria-label="${escapeHtml(m.subsidiary || "")}"><img src="${escapeHtml(m.subsidiaryLogoUrl)}" alt="" class="team-avatar-badge" /></span>` : ""}
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
                <span class="bio-readmore-text">Read More</span>
                <span class="bio-readmore-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
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