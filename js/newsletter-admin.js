// js/newsletter-admin.js
// Admin: view and remove newsletter subscribers ("newsletter" collection).

import {
  db,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
} from "./firebase-config.js";

const COLLECTION = "newsletter";
const tbody = document.getElementById("subsTableBody");
const emptyState = document.getElementById("subsEmptyState");
const navBadge = document.getElementById("newsletterNavBadge");

const confirmModal = document.getElementById("confirmModal");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const confirmOkBtn = document.getElementById("confirmOkBtn");
let confirmResolver = null;

function askConfirm(message) {
  confirmModalMessage.textContent = message;
  confirmModal.style.opacity = "1";
  confirmModal.style.visibility = "visible";
  return new Promise((resolve) => { confirmResolver = resolve; });
}
function closeConfirm(result) {
  confirmModal.style.opacity = "0";
  confirmModal.style.visibility = "hidden";
  if (confirmResolver) { confirmResolver(result); confirmResolver = null; }
}
confirmCancelBtn.addEventListener("click", () => closeConfirm(false));
confirmOkBtn.addEventListener("click", () => closeConfirm(true));

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return "—";
  const d = timestamp.toDate();
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

const subsQuery = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));

onSnapshot(subsQuery, (snapshot) => {
  const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  tbody.innerHTML = "";
  if (docs.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
    docs.forEach((sub) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(sub.email || "—")}</td>
        <td>${formatDate(sub.createdAt)}</td>
        <td>
          <div class="row-actions">
            <button class="btn-icon" data-remove="${sub.id}" title="Remove" aria-label="Remove">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await askConfirm("This subscriber will be permanently removed.");
        if (!ok) return;
        await deleteDoc(doc(db, COLLECTION, btn.dataset.remove));
      });
    });
  }

  document.getElementById("statTotalSubs").textContent = docs.length;
  if (navBadge) navBadge.textContent = String(docs.length);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = docs.filter((d) => (d.createdAt?.toMillis?.() || 0) >= sevenDaysAgo).length;
  document.getElementById("statRecentSubs").textContent = recent;
}, (err) => {
  console.error("Error loading newsletter subscribers:", err);
  emptyState.textContent = "Couldn't load subscribers — check your connection or Firestore rules.";
  emptyState.style.display = "block";
});