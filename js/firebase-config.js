// ══════════════════════════════════════════════════════════
// Firebase initialization — Marvini Elite Enterprises
// ══════════════════════════════════════════════════════════
// Replace the values in `firebaseConfig` with your own project's
// credentials: Firebase Console → Project Settings → General →
// "Your apps" → SDK setup and configuration → Config.
//
// This file is imported by both articles-admin.js (admin dashboard)
// and articles-public.js (public website).
// ══════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAveG3TjWcZCNz56ygnD44laL5XrWZCmtQ",
  authDomain: "marvini-elite-enterprises.firebaseapp.com",
  projectId: "marvini-elite-enterprises",
  storageBucket: "marvini-elite-enterprises.firebasestorage.app",
  messagingSenderId: "965392460183",
  appId: "1:965392460183:web:e86cbdc9bc401313667cd2",
  measurementId: "G-Z8NS6CY134"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Name of the Firestore collection that holds every publication
// (articles, journals, and news), regardless of draft/published status.
export const PUBLICATIONS_COLLECTION = "publications";

export {
  db,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
};