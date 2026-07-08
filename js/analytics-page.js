// js/analytics-page.js
// Real, Firestore-backed panels for analytics.html:
//  - Applications by Subsidiary (breakdown of "applications" collection)
//  - Content Overview (live document counts across site-content collections)

import { db, collection, onSnapshot } from "./firebase-config.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const COMPANY_LABELS = {
  msmart: "M-Smart Driving School",
  mfood: "M-Digital Food Chain",
  mevents: "M-Events & Festivals",
  mfarms: "M-Farms",
  mconsultancy: "M-Consultancy & Training",
  general: "General / Not Listed",
};

const PILL_CLASSES = ["active", "completed", "pending", "draft"];

// ── Applications by Subsidiary ──────────────────────────────────────
const subsidiaryBody = document.getElementById("subsidiaryBreakdownBody");
if (subsidiaryBody) {
  onSnapshot(collection(db, "applications"), (snap) => {
    const counts = {};
    snap.docs.forEach((d) => {
      const key = d.data().subsidiary || "general";
      counts[key] = (counts[key] || 0) + 1;
    });

    const total = snap.size;
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    if (total === 0) {
      subsidiaryBody.innerHTML =
        '<tr><td colspan="3" style="text-align:center;color:var(--text-muted,#64748b);padding:1.5rem;">No applications yet.</td></tr>';
      return;
    }

    subsidiaryBody.innerHTML = rows
      .map(([key, count], i) => {
        const pct = Math.round((count / total) * 100);
        const label = COMPANY_LABELS[key] || key;
        const pillClass = PILL_CLASSES[i % PILL_CLASSES.length];
        return `
          <tr>
            <td>${escapeHtml(label)}</td>
            <td>${count}</td>
            <td><span class="pill ${pillClass}">${pct}%</span></td>
          </tr>`;
      })
      .join("");
  });
}

// ── Content Overview: live counts across site-content collections ──
const contentBody = document.getElementById("contentOverviewBody");
if (contentBody) {
  const COLLECTIONS = [
    { key: "team", label: "Team Members" },
    { key: "jobs", label: "Job & Volunteer Postings" },
    { key: "news", label: "News Articles" },
    { key: "gallery", label: "Gallery Images" },
    { key: "publications", label: "Publications" },
    { key: "partners", label: "Partners" },
  ];

  const counts = {};
  COLLECTIONS.forEach(({ key }) => (counts[key] = 0));

  function render() {
    contentBody.innerHTML = COLLECTIONS
      .map(({ key, label }) => `<tr><td>${escapeHtml(label)}</td><td>${counts[key]}</td></tr>`)
      .join("");
  }
  render();

  COLLECTIONS.forEach(({ key }) => {
    onSnapshot(collection(db, key), (snap) => {
      counts[key] = snap.size;
      render();
    });
  });
}

// ── Realtime: active users right now, by page ────────────────────
const realtimeUsersEl = document.getElementById("realtimeActiveUsers");
const realtimePagesBody = document.getElementById("realtimePagesBody");

if (realtimeUsersEl && realtimePagesBody) {
  async function pollRealtime() {
    try {
      const res = await fetch("https://marvini-elite-enterprises-alpha.vercel.app/api/analytics-realtime");
      if (!res.ok) throw new Error("Request failed");
      const { totalActiveUsers, byPage, byLocation } = await res.json();

      realtimeUsersEl.textContent = totalActiveUsers;

      if (!byPage || byPage.length === 0) {
        realtimePagesBody.innerHTML =
          '<tr><td colspan="2" style="text-align:center;color:var(--text-muted,#64748b);padding:1.5rem;">No active visitors right now.</td></tr>';
      } else {
        realtimePagesBody.innerHTML = byPage
          .map(
            ({ page, activeUsers }) =>
              `<tr><td>${escapeHtml(page)}</td><td>${activeUsers}</td></tr>`
          )
          .join("");
      }

      const realtimeLocationsBody = document.getElementById("realtimeLocationsBody");
      if (realtimeLocationsBody) {
        if (!byLocation || byLocation.length === 0) {
          realtimeLocationsBody.innerHTML =
            '<tr><td colspan="2" style="text-align:center;color:var(--text-muted,#64748b);padding:1.5rem;">No active visitors right now.</td></tr>';
        } else {
          realtimeLocationsBody.innerHTML = byLocation
            .map(({ country, city, activeUsers }) => {
              const label = city && city !== "(not set)" ? `${city}, ${country}` : country;
              return `<tr><td>${escapeHtml(label)}</td><td>${activeUsers}</td></tr>`;
            })
            .join("");
        }
      }
    } catch (err) {
      console.error("Could not load realtime analytics:", err);
      realtimeUsersEl.textContent = "—";
    }
  }

  pollRealtime();
  setInterval(pollRealtime, 25000); // poll every 25s
}