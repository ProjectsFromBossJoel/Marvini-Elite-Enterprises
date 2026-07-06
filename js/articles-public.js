//js/articles-public.js
// ══════════════════════════════════════════════════════════
// Public site — Articles & Reports section
// Fetches only PUBLISHED publications from Firestore and renders
// them into the existing .articles-grid, using the same card
// markup/classes already defined in style.css.
// ══════════════════════════════════════════════════════════
import {
  db,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  PUBLICATIONS_COLLECTION,
} from "./firebase-config.js";
import { uploadToCloudinary } from "./cloudinary.js";

const grid = document.querySelector(".articles-grid");

async function renderPublishedArticles() {
  if (!grid) return;

  try {
    const q = query(
      collection(db, PUBLICATIONS_COLLECTION),
      where("status", "==", "published"),
      orderBy("publishedAt", "desc")
    );
    const snapshot = await getDocs(q);

    // Always clear whatever is currently in the grid (including any
    // dummy/static cards left in the HTML) before rendering live data.
    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted,#64748b);">No publications available yet. Check back soon.</div>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      grid.appendChild(buildArticleCard(data));
    });
  } catch (err) {
    // If Firestore is unreachable, keep whatever static cards are
    // already in the HTML rather than showing a broken section.
    console.error("Could not load publications:", err);
  }
}

function buildArticleCard(data) {
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
      <a href="${data.fileUrl}" class="btn btn-primary btn-sm article-download" target="_blank" rel="noopener noreferrer" download>
        Download Now
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
    </div>
  `;

  // Re-trigger the reveal-on-scroll animation for dynamically added cards
  requestAnimationFrame(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("revealed");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    io.observe(article);
  });

  return article;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Public submission form ──────────────────────────────
const publicSubmitForm = document.getElementById("publicSubmitForm");
const publicSubmitBtn = document.getElementById("publicSubmitBtn");
const publicSubmitStatus = document.getElementById("publicSubmitStatus");

publicSubmitForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("subTitle").value.trim();
  const description = document.getElementById("subDescription").value.trim();
  const category = document.getElementById("subCategory").value;
  const pdfFile = document.getElementById("subPdf").files[0];
  const coverFile = document.getElementById("subCover").files[0];

  if (!title || !category || !pdfFile) {
    publicSubmitStatus.textContent = "Please fill in the title, type, and choose a PDF file.";
    return;
  }

  publicSubmitBtn.disabled = true;
  publicSubmitStatus.textContent = "Uploading PDF…";

  try {
    const pdfResult = await uploadToCloudinary(pdfFile, "raw", "marvini-publications/pdfs");

    let coverResult = null;
    if (coverFile) {
      publicSubmitStatus.textContent = "Uploading cover image…";
      coverResult = await uploadToCloudinary(coverFile, "image", "marvini-publications/covers");
    }

    publicSubmitStatus.textContent = "Submitting…";

    await addDoc(collection(db, PUBLICATIONS_COLLECTION), {
      title,
      description,
      category,
      fileUrl: pdfResult.url,
      filePublicId: pdfResult.publicId,
      fileName: pdfFile.name,
      coverImageUrl: coverResult ? coverResult.url : null,
      coverPublicId: coverResult ? coverResult.publicId : null,
      status: "draft", // always starts pending review, never auto-published
      downloads: 0,
      createdAt: serverTimestamp(),
      publishedAt: null,
      submittedPublicly: true,
    });

    publicSubmitStatus.textContent = "✅ Thank you! Your submission has been received and will be reviewed.";
    publicSubmitForm.reset();
    setTimeout(() => {
      document.getElementById("submitModal")?.classList.remove("open");
      publicSubmitStatus.textContent = "";
    }, 2500);
  } catch (err) {
    console.error("Public submission failed:", err);
    publicSubmitStatus.textContent = "⚠️ Something went wrong: " + err.message;
  } finally {
    publicSubmitBtn.disabled = false;
  }
});

renderPublishedArticles();