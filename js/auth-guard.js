// js/auth-guard.js
// Include on every dashboard/*.html page (except login.html) to require sign-in.
// Firestore rules are the real security boundary — this just protects the UI/UX
// so a signed-out visitor is bounced to the login page instead of seeing the panel.

import { auth, onAuthStateChanged, signOut } from "./firebase-config.js";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Optionally show who's logged in + a sign-out control, if the page has a
  // <div class="who"> block (matches the existing topbar profile markup).
  const whoName = document.querySelector(".profile .who strong");
  if (whoName && user.email) {
    whoName.textContent = user.email;
  }

  const signOutBtn = document.getElementById("signOutBtn");
  signOutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
});