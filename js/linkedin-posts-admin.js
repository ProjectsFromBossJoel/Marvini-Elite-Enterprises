// js/linkedin-posts-admin.js
// Powers dashboard/linkedin-posts.html — prompt in, AI draft out, review, publish.

import { auth } from "./firebase-config.js";

// TODO: once you set up a custom domain on Vercel, replace this with that
// domain instead — hash-suffixed preview URLs change on every deploy, but
// this "-alpha" one is your stable production alias.
const API_BASE = "https://marvini-elite-enterprises-alpha.vercel.app";

const promptEl = document.getElementById("lpPrompt");
const generateBtn = document.getElementById("lpGenerateBtn");
const regenBtn = document.getElementById("lpRegenBtn");
const copyBtn = document.getElementById("lpCopyBtn");
const publishBtn = document.getElementById("lpPublishBtn");
const outputEl = document.getElementById("lpOutput");
const emptyState = document.getElementById("lpEmptyState");
const charCount = document.getElementById("lpCharCount");
const genPill = document.getElementById("lpGenPill");
const genText = document.getElementById("lpGenText");
const connPill = document.getElementById("lpConnPill");
const connText = document.getElementById("lpConnText");
const resultBox = document.getElementById("lpResult");

let lastPrompt = "";

// ---------- helpers ----------
function setGenState(state) {
  // state: idle | generating | ready | publishing | live | error
  genPill.className = `lp-pill ${state}`;
  connPill.className = `lp-pill ${state === "error" ? "error" : "ready"}`;
  const labels = {
    idle: "idle",
    generating: "generating…",
    ready: "draft ready",
    publishing: "publishing…",
    live: "live",
    error: "error",
  };
  genText.textContent = labels[state] || state;
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

function showOutput(text) {
  emptyState.style.display = "none";
  outputEl.style.display = "block";
  outputEl.value = text;
  charCount.textContent = text.length;
}

function typewriter(text) {
  // Simple progressive reveal — Groq's response arrives all at once, so this
  // just makes it *feel* like it's streaming, matching the console aesthetic.
  emptyState.style.display = "none";
  outputEl.style.display = "block";
  outputEl.value = "";
  let i = 0;
  const speed = Math.max(4, Math.floor(600 / text.length)); // faster for long posts
  const interval = setInterval(() => {
    outputEl.value += text[i];
    charCount.textContent = outputEl.value.length;
    outputEl.scrollTop = outputEl.scrollHeight;
    i++;
    if (i >= text.length) {
      clearInterval(interval);
      setGenState("ready");
      regenBtn.disabled = false;
      copyBtn.disabled = false;
      publishBtn.disabled = false;
    }
  }, speed);
}

function showResult(kind, html) {
  resultBox.className = `lp-result show ${kind}`;
  resultBox.innerHTML = html;
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

  try {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api/admin/linkedin-post`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "generate", prompt }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Draft generation failed");
    }
    typewriter(data.generatedText);
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

  publishBtn.disabled = true;
  regenBtn.disabled = true;
  setGenState("publishing");
  resultBox.className = "lp-result";

  try {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api/admin/linkedin-post`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "post", text }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Publish failed");
    }
    setGenState("live");
    showResult("success", `Posted to LinkedIn. <a href="${data.postUrl}" target="_blank" rel="noopener">View the live post →</a>`);
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
  charCount.textContent = outputEl.value.length;
});

document.querySelectorAll("[data-fill]").forEach((chip) => {
  chip.addEventListener("click", () => {
    promptEl.value = chip.dataset.fill;
    promptEl.focus();
  });
});

promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    generate(promptEl.value);
  }
});

// Reflect auth state on load (auth-guard.js already redirects if signed out,
// this just flips the connection pill once Firebase confirms the session)
auth.onAuthStateChanged((user) => setConnected(!!user));