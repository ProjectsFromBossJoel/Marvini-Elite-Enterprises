// js/settings-admin.js
// Powers dashboard/settings.html — General site settings, Notification toggles,
// and a read-only Access table pulled from the same `users` collection users.html uses.
//
// SPARK PLAN NOTE: there is no Cloud Function here gating outbound emails —
// Spark doesn't support Functions with outbound network calls (that needs Blaze).
// So the `contactMessageEmail` / `careerApplicationEmail` / `newsletterSignupEmail`
// flags below are only useful if whatever client-side code actually sends those
// emails (e.g. your contact form / careers form submit handlers) reads this same
// settings/notifications doc before firing. If you paste those submit-handler
// files, I'll wire the check into them directly — right now this file only
// reads/writes the toggle state, it doesn't enforce it anywhere else yet.

import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  where,
} from "./firebase-config.js";

const ROLE_LABELS = { admin: "Site Administrator", hr: "HR", it_support: "IT Support" };

// ── Elements ──
const generalForm = {
  siteName: document.getElementById("settingSiteName"),
  tagline: document.getElementById("settingTagline"),
  contactEmail: document.getElementById("settingContactEmail"),
  careersEmail: document.getElementById("settingCareersEmail"),
  hqAddress: document.getElementById("settingHqAddress"),
};
const saveGeneralBtn = document.getElementById("saveGeneralBtn");
const generalStatus = document.getElementById("generalStatus");

const notifToggles = {
  contactMessageEmail: document.getElementById("toggleContactMessage"),
  careerApplicationEmail: document.getElementById("toggleCareerApplication"),
  newsletterSignupEmail: document.getElementById("toggleNewsletterSignup"),
};
const notifStatus = document.getElementById("notifStatus");

const accessTableBody = document.getElementById("accessTableBody");

// ─────────────────────────────────────────────
// Wait for auth-guard.js to resolve the user
// ─────────────────────────────────────────────
function whenReady(cb) {
  if (window.marviniUser) return cb();
  const t = setInterval(() => {
    if (window.marviniUser) {
      clearInterval(t);
      cb();
    }
  }, 50);
}

whenReady(() => {
  const isAdmin = window.marviniUser.role === "admin";

  // Non-admins can look but not touch — inputs/toggles disabled, no save buttons wired.
  if (!isAdmin) {
    Object.values(generalForm).forEach((el) => el && (el.disabled = true));
    Object.values(notifToggles).forEach((el) => el && (el.disabled = true));
    if (saveGeneralBtn) saveGeneralBtn.style.display = "none";
  }

  loadGeneralSettings();
  loadNotificationSettings(isAdmin);
  loadAccessTable();

  if (isAdmin && saveGeneralBtn) {
    saveGeneralBtn.addEventListener("click", saveGeneralSettings);
  }
});

// ── General settings: load once, save on button click ──
async function loadGeneralSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "general"));
    if (snap.exists()) {
      const d = snap.data();
      if (generalForm.siteName) generalForm.siteName.value = d.siteName || "";
      if (generalForm.tagline) generalForm.tagline.value = d.tagline || "";
      if (generalForm.contactEmail) generalForm.contactEmail.value = d.contactEmail || "";
      if (generalForm.careersEmail) generalForm.careersEmail.value = d.careersEmail || "";
      if (generalForm.hqAddress) generalForm.hqAddress.value = d.hqAddress || "";
    }
  } catch (err) {
    console.error("settings-admin: failed to load general settings", err);
    if (generalStatus) generalStatus.textContent = "Could not load settings.";
  }
}

async function saveGeneralSettings() {
  if (!saveGeneralBtn) return;
  saveGeneralBtn.disabled = true;
  if (generalStatus) generalStatus.textContent = "Saving…";

  try {
    await setDoc(
      doc(db, "settings", "general"),
      {
        siteName: generalForm.siteName?.value.trim() || "",
        tagline: generalForm.tagline?.value.trim() || "",
        contactEmail: generalForm.contactEmail?.value.trim() || "",
        careersEmail: generalForm.careersEmail?.value.trim() || "",
        hqAddress: generalForm.hqAddress?.value.trim() || "",
      },
      { merge: true }
    );
    if (generalStatus) generalStatus.textContent = "Saved ✓";
    setTimeout(() => { if (generalStatus) generalStatus.textContent = ""; }, 2000);
  } catch (err) {
    console.error(err);
    if (generalStatus) generalStatus.textContent = "Error saving — try again.";
  }

  saveGeneralBtn.disabled = false;
}

// ── Notifications: load once, each toggle saves itself immediately on change ──
async function loadNotificationSettings(isAdmin) {
  let data = {};
  try {
    const snap = await getDoc(doc(db, "settings", "notifications"));
    if (snap.exists()) data = snap.data();
  } catch (err) {
    console.error("settings-admin: failed to load notification settings", err);
  }

  // Defaults match what's already live: contact + career on, newsletter off.
  const current = {
    contactMessageEmail: data.contactMessageEmail ?? true,
    careerApplicationEmail: data.careerApplicationEmail ?? true,
    newsletterSignupEmail: data.newsletterSignupEmail ?? false,
  };

  Object.entries(notifToggles).forEach(([key, el]) => {
    if (!el) return;
    el.checked = current[key];
    if (isAdmin) {
      el.addEventListener("change", () => saveNotificationToggle(key, el.checked));
    }
  });
}

async function saveNotificationToggle(key, value) {
  if (notifStatus) notifStatus.textContent = "Saving…";
  try {
    await setDoc(doc(db, "settings", "notifications"), { [key]: value }, { merge: true });
    if (notifStatus) notifStatus.textContent = "Saved ✓";
    setTimeout(() => { if (notifStatus) notifStatus.textContent = ""; }, 1500);
  } catch (err) {
    console.error(err);
    if (notifStatus) notifStatus.textContent = "Error — change not saved.";
  }
}

// ── Access table: live, read-only summary of active dashboard users ──
function loadAccessTable() {
  if (!accessTableBody) return;
  const q = query(collection(db, "users"), where("status", "==", "active"));
  onSnapshot(q, (snap) => {
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!users.length) {
      accessTableBody.innerHTML =
        `<tr><td colspan="4" style="text-align:center;color:var(--text-muted,#64748b);padding:1.5rem;">No active users.</td></tr>`;
      return;
    }
    accessTableBody.innerHTML = users.map((u) => `
      <tr>
        <td><div class="student-cell"><img src="${u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.email)}&background=1a56ff&color=fff`}"/><div><strong>${escapeHtml(u.name || u.email || "—")}</strong></div></div></td>
        <td>${ROLE_LABELS[u.role] || u.role || "—"}</td>
        <td><span class="pill completed">Full Access</span></td>
        <td><div class="row-actions"><a href="/dashboard/users.html" aria-label="Manage in Users"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></a></div></td>
      </tr>
    `).join("");
  }, (err) => {
    console.error("settings-admin: access table listener failed", err);
    accessTableBody.innerHTML =
      `<tr><td colspan="4" style="text-align:center;color:var(--text-muted,#64748b);padding:1.5rem;">Could not load users.</td></tr>`;
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}