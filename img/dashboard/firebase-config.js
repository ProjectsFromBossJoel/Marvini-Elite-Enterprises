// ═══════════════════════════════════════════════════════
// FIREBASE CONFIG — Marvini Elite Enterprises Admin
// CDN modular imports (Firebase v10)
// Replace the config values below with your project's values
// (Firebase Console → Project Settings → General → Your apps)
// ═══════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// ── Your Firebase project config ──────────────────────────
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
};

// ── Firestore collections used by this admin ──────────────
// news        → { title, tag, excerpt, imageUrl, date, published }
// team        → { name, role, company, bio, bioText, imageUrl, linkedin, twitter, featured, order }
// companies   → { name, tag, desc, iconUrl, websiteUrl, learnMoreUrl, order }
// gallery     → { imageUrl, caption, category }
// articles    → { title, desc, coverImageUrl, pdfUrl }
// messages    → { name, email, phone, subject, message, createdAt, read }
// config      → single doc "site" with { heroStats, contactEmail, socials, footerAbout }
