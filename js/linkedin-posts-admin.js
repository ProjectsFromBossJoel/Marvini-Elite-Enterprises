// js/linkedin-posts-admin.js
// Powers dashboard/linkedin-posts.html — prompt in, AI draft out, review, publish.
// Supports LinkedIn + X via a platform toggle. Generating a LinkedIn draft
// automatically triggers a background condense pass so an X-sized version
// is ready the moment you switch tabs — no second prompt needed.

import {
  auth,
  db,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  LINKEDIN_POSTS_COLLECTION,
  X_POSTS_COLLECTION,
} from "./firebase-config.js";

const API_BASE = "https://marvini-elite-enterprises-alpha.vercel.app";

const PLATFORMS = {
  linkedin: {
    label: "LinkedIn Posts",
    sub: "Describe what to post. Review the draft. Publish when it's ready.",
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;vertical-align:-4px;"><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/><path d="M10 9h4v2c1-1.5 2.5-2.5 4.5-2.5 3.5 0 5.5 2 5.5 6.5V21h-4v-5.5c0-1.5-.5-2.5-2-2.5s-2 1-2 2.5V21h-4z"/></svg>`,
    endpoint: "/api/admin/linkedin-post",
    charLimit: null,
    publishLabel: "Post to LinkedIn",
    successVerb: "Posted to LinkedIn",
    historyCollection: LINKEDIN_POSTS_COLLECTION,
  },
  x: {
    label: "X Posts",
    sub: "Describe what to post. Keep it tight — X caps posts at 280 characters.",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px;vertical-align:-3px;"><path d="M18.9 2H22l-7.6 8.7L23.3 22H16.7l-5.2-6.8L5.6 22H2.4l8.2-9.3L1.7 2h6.8l4.7 6.2L18.9 2z"/></svg>`,
    endpoint: "/api/admin/x-post",
    charLimit: 280,
    publishLabel: "Post to X",
    successVerb: "Posted to X",
    historyCollection: X_POSTS_COLLECTION,
  },
};

let currentPlatform = "linkedin";

// Per-platform state so switching tabs doesn't wipe a draft you already have.
const state = {
  linkedin: { text: "", genState: "idle", isAuto: false },
  x: { text: "", genState: "idle", isAuto: false },
};

const promptEl = document.getElementById("lpPrompt");
const generateBtn = document.getElementById("lpGenerateBtn");
const regenBtn = document.getElementById("lpRegenBtn");
const copyBtn = document.getElementById("lpCopyBtn");
const publishBtn = document.getElementById("lpPublishBtn");
const publishLabel = document.getElementById("lpPublishLabel");
const outputEl = document.getElementById("lpOutput");
const emptyState = document.getElementById("lpEmptyState");
const charCount = document.getElementById("lpCharCount");
const charLimitEl = document.getElementById("lpCharLimit");
const costNoteEl = document.getElementById("lpCostNote");
const genPill = document.getElementById("lpGenPill");
const genText = document.getElementById("lpGenText");
const connPill = document.getElementById("lpConnPill");
const connText = document.getElementById("lpConnText");
const resultBox = document.getElementById("lpResult");
const platformTitle = document.getElementById("lpPlatformTitle");
const platformSub = document.getElementById("lpPlatformSub");
const platformIcon = document.getElementById("lpPlatformIcon");
const tabLinkedin = document.getElementById("lpTabLinkedin");
const tabX = document.getElementById("lpTabX");

let lastPrompt = "";

// ---------- platform switching ----------
function renderPlatform() {
  const cfg = PLATFORMS[currentPlatform];
  const s = state[currentPlatform];

  platformTitle.textContent = cfg.label;
  platformSub.textContent = cfg.sub;
  platformIcon.innerHTML = cfg.icon;
  publishLabel.textContent = cfg.publishLabel;

  tabLinkedin.classList.toggle("active", currentPlatform === "linkedin");
  tabX.classList.toggle("active", currentPlatform === "x");

  charLimitEl.textContent = cfg.charLimit ? ` / ${cfg.charLimit}` : "";
  resultBox.className = "lp-result";

  if (s.text) {
    emptyState.style.display = "none";
    outputEl.style.display = "block";
    outputEl.value = s.text;
    updateCharUI(s.text);
    regenBtn.disabled = false;
    copyBtn.disabled = false;
    publishBtn.disabled = cfg.charLimit ? s.text.length > cfg.charLimit : false;
  } else {
    emptyState.style.display = "flex";
    outputEl.style.display = "none";
    outputEl.value = "";
    charCount.textContent = "0";
    costNoteEl.textContent = "";
    regenBtn.disabled = true;
    copyBtn.disabled = true;
    publishBtn.disabled = true;
  }

  setGenState(s.genState);
  renderTokenCountdown();
}

function switchPlatform(platform) {
  currentPlatform = platform;
  renderPlatform();
  if (historyView.style.display !== "none") loadHistory();
}

tabLinkedin.addEventListener("click", () => switchPlatform("linkedin"));
tabX.addEventListener("click", () => switchPlatform("x"));

// ---------- helpers ----------
function setGenState(genState) {
  state[currentPlatform].genState = genState;
  genPill.className = `lp-pill ${genState}`;
  connPill.className = `lp-pill ${genState === "error" ? "error" : "ready"}`;
  const labels = {
    idle: "idle",
    generating: "generating…",
    condensing: "condensing for X…",
    ready: "draft ready",
    publishing: "publishing…",
    live: "live",
    error: "error",
  };
  genText.textContent = labels[genState] || genState;
}

function setConnected(ok) {
  connPill.className = `lp-pill ${ok ? "ready" : "error"}`;
  connText.textContent = ok ? "connected" : "not signed in";
}

async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  return user.getIdToken();
}

function updateCharUI(text) {
  const cfg = PLATFORMS[currentPlatform];
  charCount.textContent = text.length;

  if (cfg.charLimit) {
    const over = text.length > cfg.charLimit;
    charLimitEl.className = over ? "over" : "";
    if (over) {
      costNoteEl.textContent = `⚠ ${text.length - cfg.charLimit} over limit — trim before posting`;
      costNoteEl.style.color = "#f87171";
    } else {
      const hasLink = /https?:\/\//i.test(text);
      costNoteEl.textContent = hasLink ? "≈$0.20 to post (contains a link)" : "≈$0.015 to post";
      costNoteEl.style.color = "#475569";
    }
  } else {
    charLimitEl.className = "";
    costNoteEl.textContent = "";
  }
}

function typewriter(text, onDone) {
  emptyState.style.display = "none";
  outputEl.style.display = "block";
  outputEl.value = "";
  let i = 0;
  const speed = Math.max(4, Math.floor(500 / text.length));
  const interval = setInterval(() => {
    outputEl.value += text[i];
    updateCharUI(outputEl.value);
    outputEl.scrollTop = outputEl.scrollHeight;
    i++;
    if (i >= text.length) {
      clearInterval(interval);
      if (onDone) onDone();
    }
  }, speed);
}

function showResult(kind, html) {
  resultBox.className = `lp-result show ${kind}`;
  resultBox.innerHTML = html;
}

// ---------- background X condensing ----------
async function condenseForX(linkedinText) {
  state.x.genState = "condensing";
  state.x.isAuto = true;
  if (currentPlatform === "x") setGenState("condensing");

  try {
    const token = await getToken();
    const condensePrompt = `Rewrite the following LinkedIn post as a punchy, standalone X (Twitter) post under 280 characters. Keep the core message and key facts (dates, names, figures) exact. Use at most 1-2 relevant hashtags. No markdown.\n\nLinkedIn post:\n${linkedinText}`;

    const res = await fetch(`${API_BASE}${PLATFORMS.x.endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", prompt: condensePrompt }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Condense failed");

    state.x.text = data.generatedText;
    state.x.genState = "ready";

    if (currentPlatform === "x") {
      typewriter(data.generatedText, () => {
        setGenState("ready");
        regenBtn.disabled = false;
        copyBtn.disabled = false;
        publishBtn.disabled = data.generatedText.length > 280;
      });
    }
  } catch (err) {
    state.x.genState = "idle";
    // Silent-ish failure — the LinkedIn draft still succeeded, so we don't
    // want to throw an error banner over that success. Log for debugging.
    console.warn("Auto-condense for X failed:", err.message);
  }
}

// ---------- actions ----------
async function generate(prompt) {
  if (!prompt || !prompt.trim()) {
    promptEl.focus();
    return;
  }
  lastPrompt = prompt;
  generateBtn.disabled = true;
  regenBtn.disabled = true;
  publishBtn.disabled = true;
  copyBtn.disabled = true;
  resultBox.className = "lp-result";
  setGenState("generating");

  const platformAtRequestTime = currentPlatform;
  const cfg = PLATFORMS[platformAtRequestTime];

  try {
    const token = await getToken();
    const res = await fetch(`${API_BASE}${cfg.endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", prompt }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Draft generation failed");

    state[platformAtRequestTime].text = data.generatedText;
    state[platformAtRequestTime].isAuto = false;

    typewriter(data.generatedText, () => {
      setGenState("ready");
      regenBtn.disabled = false;
      copyBtn.disabled = false;
      const limit = cfg.charLimit;
      publishBtn.disabled = limit ? data.generatedText.length > limit : false;

      // The auto-condense hop: only LinkedIn → X, one direction, as requested.
      if (platformAtRequestTime === "linkedin") {
        condenseForX(data.generatedText);
      }
    });
  } catch (err) {
    setGenState("error");
    showResult("error", `Draft generation failed — ${err.message}`);
  } finally {
    generateBtn.disabled = false;
  }
}

async function publish() {
  const text = outputEl.value.trim();
  if (!text) return;

  const cfg = PLATFORMS[currentPlatform];
  if (cfg.charLimit && text.length > cfg.charLimit) return;

  publishBtn.disabled = true;
  regenBtn.disabled = true;
  setGenState("publishing");
  resultBox.className = "lp-result";

  try {
    const token = await getToken();
    const res = await fetch(`${API_BASE}${cfg.endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "post", text }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Publish failed");

    setGenState("live");
    showResult("success", `${cfg.successVerb}. <a href="${data.postUrl}" target="_blank" rel="noopener">View the live post →</a>`);

    // Save to history — fire-and-forget, doesn't block the success message
    // if it fails for some reason (e.g. a rules hiccup).
    try {
      await addDoc(collection(db, cfg.historyCollection), {
        text,
        postUrl: data.postUrl || null,
        prompt: lastPrompt,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Failed to save post to history:", err.message);
    }
  } catch (err) {
    setGenState("error");
    showResult("error", `Publish failed — ${err.message}`);
    publishBtn.disabled = false;
  } finally {
    regenBtn.disabled = false;
  }
}

// ---------- wiring ----------
generateBtn.addEventListener("click", () => generate(promptEl.value));
regenBtn.addEventListener("click", () => generate(lastPrompt));
publishBtn.addEventListener("click", publish);

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(outputEl.value);
  copyBtn.style.color = "#22c55e";
  setTimeout(() => (copyBtn.style.color = ""), 800);
});

outputEl.addEventListener("input", () => {
  state[currentPlatform].text = outputEl.value;
  state[currentPlatform].isAuto = false; // manual edit overrides the auto flag
  updateCharUI(outputEl.value);
});

document.querySelectorAll("[data-fill]").forEach((chip) => {
  chip.addEventListener("click", () => {
    promptEl.value = chip.dataset.fill;
    promptEl.focus();
  });
});

promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(promptEl.value);
});

auth.onAuthStateChanged((user) => setConnected(!!user));

// ---------- LinkedIn token expiry countdown ----------
const TOKEN_EXPIRES_AT = new Date("2026-09-16T00:00:00Z");

function daysUntilExpiry() {
  const msLeft = TOKEN_EXPIRES_AT - new Date();
  return Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
}

function renderTokenCountdown() {
  const el = document.getElementById("lpTokenNote");
  const banner = document.getElementById("lpExpiryBanner");
  if (currentPlatform !== "linkedin") {
    if (el) el.textContent = "";
    if (banner) banner.style.display = "none";
    return;
  }
  const days = daysUntilExpiry();
  if (el) {
    if (days <= 0) { el.textContent = "⚠ LinkedIn token expired"; el.style.color = "#f87171"; }
    else if (days <= 7) { el.textContent = `⚠ token expires in ${days}d`; el.style.color = "#f59e0b"; }
    else { el.textContent = `token valid · ${days}d left`; el.style.color = ""; }
  }
  if (banner) {
    if (days <= 0) { banner.className = "lp-banner expired"; banner.style.display = "flex"; banner.textContent = "⚠ LinkedIn access token has expired. Publishing will fail until you reauthorize."; }
    else if (days <= 7) { banner.className = "lp-banner warn"; banner.style.display = "flex"; banner.textContent = `⚠ LinkedIn access token expires in ${days} day${days === 1 ? "" : "s"}.`; }
    else { banner.style.display = "none"; }
  }
}

// ---------- Compose / History view toggle ----------
const viewComposeBtn = document.getElementById("lpViewCompose");
const viewHistoryBtn = document.getElementById("lpViewHistory");
const composeView = document.getElementById("lpComposeView");
const historyView = document.getElementById("lpHistoryView");
const historyList = document.getElementById("lpHistoryList");

function timeAgo(date) {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

async function loadHistory() {
  const cfg = PLATFORMS[currentPlatform];
  historyList.innerHTML = `<div class="lp-history-empty">Loading…</div>`;

  try {
    const q = query(
      collection(db, cfg.historyCollection),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      historyList.innerHTML = `<div class="lp-history-empty">No posts yet on ${cfg.label.replace(" Posts", "")}.</div>`;
      return;
    }

    historyList.innerHTML = "";
    snap.forEach((doc) => {
      const d = doc.data();
      const when = d.createdAt ? timeAgo(d.createdAt.toDate()) : "";
      const item = document.createElement("div");
      item.className = "lp-history-item";
      item.innerHTML = `
        <div class="lp-history-top">
          <span class="lp-history-platform">${cfg.label.replace(" Posts", "")}</span>
          <span class="lp-history-time">${when}</span>
        </div>
        <p class="lp-history-text">${d.text ? d.text.replace(/</g, "&lt;") : ""}</p>
        ${d.postUrl ? `<a class="lp-history-link" href="${d.postUrl}" target="_blank" rel="noopener">View live post →</a>` : ""}
      `;
      historyList.appendChild(item);
    });
  } catch (err) {
    historyList.innerHTML = `<div class="lp-history-empty">Couldn't load history — ${err.message}</div>`;
  }
}

function showComposeView() {
  viewComposeBtn.classList.add("active");
  viewHistoryBtn.classList.remove("active");
  composeView.style.display = "block";
  historyView.style.display = "none";
}

function showHistoryView() {
  viewComposeBtn.classList.remove("active");
  viewHistoryBtn.classList.add("active");
  composeView.style.display = "none";
  historyView.style.display = "block";
  loadHistory();
}

viewComposeBtn.addEventListener("click", showComposeView);
viewHistoryBtn.addEventListener("click", showHistoryView);

renderPlatform();