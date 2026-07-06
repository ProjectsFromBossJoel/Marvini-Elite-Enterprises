// js/firebase-config.js
// Central Firebase init. Both dashboard/js/articles-admin.js and js/articles-public.js
// import from this file so there's a single Firestore connection.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ⚠️ Replace with your actual Firebase project config (Project settings → General → Your apps)
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
export const db = getFirestore(app);
export const auth = getAuth(app);

// Re-export the Firestore + Auth helpers so other files only need one import source
export {
  collection,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};

// Exposed so js/users-admin.js can spin up a *second*, isolated Firebase App
// instance when creating new admin users — createUserWithEmailAndPassword
// signs in as the new user on whatever app instance you call it on, so we
// don't want that to be this shared `app`/`auth` (it would boot the current admin).
export { firebaseConfig };

export const PUBLICATIONS_COLLECTION = "publications";
export const USERS_COLLECTION = "users";