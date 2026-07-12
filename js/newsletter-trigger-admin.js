// js/newsletter-trigger-admin.js
// Watches for newly published news and surfaces a small agent widget
// prompting the signed-in admin to send the newsletter.

import {
  db,
  auth,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
} from "./firebase-config.js";

const NEWSLETTER_API_URL = "https://marvini-elite-enterprises-alpha.vercel.app/api/send-newsletter";

const widget = document.getElementById("nlWidget");
const toggle = document.getElementById("nlToggle");
const toggleDot = document.getElementById("nlToggleDot");
const win = document.getElementById("nlWindow");
const messages = document.getElementById("nlMessages");
const minimizeBtn = document.getElementById("nlMinimize");

let latestNews = null;
let lastSentAtMillis = 0;
let dismissedNewsId = null;
let currentPromptNewsId = null;

function millisFromTimestamp(ts) {
  return ts?.toMillis ? ts.toMillis() : 0;
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
function openWidget() {
  win.classList.add("open");
  win.setAttribute("aria-hidden", "false");
}
function closeWidget() {
  win.classList.remove("open");
  win.setAttribute("aria-hidden", "true");
}

toggle?.addEventListener("click", () => {
  win.classList.contains("open") ? closeWidget() : openWidget();
});
minimizeBtn?.addEventListener("click", closeWidget);

function addMessage(html) {
  const div = document.createElement("div");
  div.className = "nl-message bot";
  div.innerHTML = `<div class="nl-bubble">${html}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function showPrompt(newsItem) {
  currentPromptNewsId = newsItem.id;
  messages.innerHTML = "";
  addMessage(
    `I noticed <strong>"${escapeHtml(newsItem.title || "Untitled")}"</strong> was just published. Do you want me to send it to our news subscribers?`
  );

  const actions = document.createElement("div");
  actions.className = "nl-actions";
  actions.innerHTML = `
    <button class="nl-btn nl-btn-primary" id="nlSendBtn">Yes, Send</button>
    <button class="nl-btn nl-btn-ghost" id="nlDismissBtn">Not Now</button>
  `;
  messages.appendChild(actions);

  document.getElementById("nlSendBtn").addEventListener("click", () => handleSend(newsItem));
  document.getElementById("nlDismissBtn").addEventListener("click", () => handleDismiss(newsItem));

  widget.style.display = "block";
  toggleDot.style.display = "block";
  openWidget();
}

async function handleSend(newsItem) {
  document.getElementById("nlSendBtn").disabled = true;
  document.getElementById("nlDismissBtn").disabled = true;
  addMessage("Sending now…");

  try {
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch(NEWSLETTER_API_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json();

    if (data.success) {
      addMessage(`✅ Sent to ${data.sentCount ?? 0} subscriber(s).`);
    } else {
      addMessage(`⚠️ ${escapeHtml(data.error || "Could not send newsletter.")}`);
    }
  } catch (err) {
    console.error("Newsletter trigger failed:", err);
    addMessage("⚠️ Could not reach the newsletter service.");
  }

  toggleDot.style.display = "none";
}

function handleDismiss(newsItem) {
  dismissedNewsId = newsItem.id;
  addMessage("Okay, I won't send it. I'll ask again if another article is published.");
  toggleDot.style.display = "none";
}

function evaluate() {
  if (!latestNews || !auth.currentUser) return;
  const newsMillis = millisFromTimestamp(latestNews.createdAt);
  const isNew = newsMillis > lastSentAtMillis;
  const alreadyHandled = latestNews.id === dismissedNewsId || latestNews.id === currentPromptNewsId;
  if (isNew && !alreadyHandled) {
    showPrompt(latestNews);
  }
}

const latestNewsQuery = query(
  collection(db, "news"),
  where("status", "==", "published"),
  orderBy("createdAt", "desc"),
  limit(1)
);
onSnapshot(latestNewsQuery, (snap) => {
  latestNews = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  evaluate();
});

onSnapshot(doc(db, "settings", "newsletter"), (snap) => {
  lastSentAtMillis = snap.exists() ? millisFromTimestamp(snap.data().lastSentAt) : 0;
  evaluate();
});