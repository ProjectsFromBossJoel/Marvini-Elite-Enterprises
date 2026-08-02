// js/auth-guard.js
// Include on every dashboard/*.html page (except login.html) to require sign-in.
// Firestore rules are the real security boundary — this just protects the UI/UX
// so a signed-out visitor is bounced to the login page instead of seeing the panel.

import {
  auth,
  db,
  doc,
  onSnapshot,
  onAuthStateChanged,
  signOut,
  USERS_COLLECTION,
} from "./firebase-config.js";

const ROLE_LABELS = {
  admin: "Site Administrator",
  hr: "HR",
  it_support: "IT Support",
};

let unsubscribeProfile = null;

onAuthStateChanged(auth, (user) => {
  if (unsubscribeProfile) {
    unsubscribeProfile();
    unsubscribeProfile = null;
  }

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Live listener instead of a one-time read: any Firestore change to this
  // user's doc (role, pages, status) re-runs this callback immediately, in
  // every open tab, with no manual refresh needed.
  unsubscribeProfile = onSnapshot(
    doc(db, USERS_COLLECTION, user.uid),
    (snap) => {
      const profile = snap.exists() ? snap.data() : null;

      if (!profile || profile.status === "disabled") {
        signOut(auth).finally(() => {
          window.location.href = "login.html";
        });
        return;
      }

      window.marviniUser = {
        uid: user.uid,
        email: user.email,
        role: profile.role,
        name: profile.name || user.email,
        pages: profile.pages || [],
        photoURL: profile.photoURL || null,
        canSendNewsletter: !!profile.canSendNewsletter,
        canUploadAgentImages: !!profile.canUploadAgentImages,
      };

      // Let other page scripts (loaded before this listener resolves, or
      // that need to react to a role/permission change live) know the
      // user profile has just been (re)loaded or updated.
      window.dispatchEvent(new CustomEvent("marvini:user-updated"));

      // Toggle visibility (not remove()) so a re-granted page can reappear
      // live too, without needing a reload.
      document.querySelectorAll(".nav-item[data-page]").forEach((link) => {
        const page = link.dataset.page;
        const allowed = profile.role === "admin" || (profile.pages || []).includes(page);
        link.style.display = allowed ? "" : "none";
      });

      // If the page currently open just got revoked, bounce off it right away
      // instead of leaving a stale panel visible on screen.
      const activeLink = document.querySelector(".nav-item[data-page].active");
      const currentPage = activeLink?.dataset.page;
      if (
        currentPage &&
        profile.role !== "admin" &&
        !(profile.pages || []).includes(currentPage)
      ) {
        window.location.href = "index.html";
        return;
      }

      const whoName = document.querySelector(".profile .who strong");
      if (whoName) whoName.textContent = profile.name || user.email;

      const whoRole = document.querySelector(".profile .who span");
      if (whoRole) whoRole.textContent = ROLE_LABELS[profile.role] || profile.role;

      const profileImg = document.querySelector(".profile img");
      if (profileImg) {
        profileImg.src = profile.photoURL ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || user.email)}&background=1a56ff&color=fff`;
      }
    },
    (err) => {
      console.error("auth-guard: failed to load user profile", err);
    }
  );

  const signOutBtn = document.getElementById("signOutBtn");
  signOutBtn?.addEventListener("click", async () => {
    window.marviniUser = null;
    if (unsubscribeProfile) unsubscribeProfile();
    await signOut(auth);
    window.location.replace("login.html");
  });
});

// If the browser restores this page from its back-forward cache (e.g. the
// user hits Back after logging out), force a full reload so onAuthStateChanged
// runs again from scratch instead of showing the stale, already-rendered page.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});