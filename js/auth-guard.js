// js/auth-guard.js
// Include on every dashboard/*.html page (except login.html) to require sign-in.
// Firestore rules are the real security boundary — this just protects the UI/UX
// so a signed-out visitor is bounced to the login page instead of seeing the panel.

import {
  auth,
  db,
  doc,
  getDoc,
  onAuthStateChanged,
  signOut,
  USERS_COLLECTION,
} from "./firebase-config.js";

const ROLE_LABELS = {
  admin: "Site Administrator",
  hr: "HR",
  it_support: "IT Support",
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Look up this user's role/status doc. If it's missing or disabled,
  // they don't get into the dashboard — sign them back out.
  let profile = null;
  try {
    const snap = await getDoc(doc(db, USERS_COLLECTION, user.uid));
    if (snap.exists()) profile = snap.data();
  } catch (err) {
    console.error("auth-guard: failed to load user profile", err);
  }

  if (!profile || profile.status === "disabled") {
    await signOut(auth);
    window.location.href = "login.html";
    return;
  }

  // Make the role + assigned pages available to every dashboard page/script
  // without each one needing its own Firestore read.
  window.marviniUser = {
    uid: user.uid,
    email: user.email,
    role: profile.role,
    name: profile.name || user.email,
    pages: profile.pages || [],
    photoURL: profile.photoURL || null,
  };

  // Admins always see every nav link. Everyone else only sees the pages
  // explicitly assigned to them in their Firestore user doc (see users.html).
  if (profile.role !== "admin") {
    document.querySelectorAll(".nav-item[data-page]").forEach((link) => {
      const page = link.dataset.page;
      if (!profile.pages || !profile.pages.includes(page)) {
        link.remove();
      }
    });
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

  const signOutBtn = document.getElementById("signOutBtn");
  signOutBtn?.addEventListener("click", async () => {
    window.marviniUser = null;
    await signOut(auth);
    // replace() drops this page from history, so Back can't return to it.
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