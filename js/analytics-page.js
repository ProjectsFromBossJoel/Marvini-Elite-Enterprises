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
      const { totalActiveUsers, byPage, byLocation, byCountry } = await res.json();

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

      renderRealtimeMap(byLocation);
    } catch (err) {
      console.error("Could not load realtime analytics:", err);
      realtimeUsersEl.textContent = "—";
      realtimePagesBody.innerHTML =
        '<tr><td colspan="2" style="text-align:center;color:var(--text-muted,#64748b);padding:1.5rem;">Realtime analytics unavailable.</td></tr>';
      const realtimeLocationsBody = document.getElementById("realtimeLocationsBody");
      if (realtimeLocationsBody) {
        realtimeLocationsBody.innerHTML =
          '<tr><td colspan="2" style="text-align:center;color:var(--text-muted,#64748b);padding:1.5rem;">Realtime analytics unavailable.</td></tr>';
      }
      const mapContainer = document.getElementById("realtimeMap");
      if (mapContainer) mapContainer.innerHTML = '';
    }
  }

  pollRealtime();
  setInterval(pollRealtime, 25000); // poll every 25s
}


// ── Realtime map: pulsing live pins at visitor locations (Leaflet) ─────
// GA4 gives city names, not coordinates — this lookup maps known cities
// to lat/lng. Extend LOCATION_COORDS as new real cities show up in traffic.
// Unmatched cities fall back to a rough country centroid; completely
// unmapped countries are skipped rather than guessed.
const LOCATION_COORDS = {
  "accra|GH": [5.6037, -0.1870],
  "kumasi|GH": [6.6885, -1.6244],
  "tamale|GH": [9.4008, -0.8393],
  "takoradi|GH": [4.8845, -1.7554],
  "cape coast|GH": [5.1053, -1.2466],
  "tema|GH": [5.6698, -0.0166],
  "ho|GH": [6.6000, 0.4667],
  "koforidua|GH": [6.0940, -0.2610],
  "sunyani|GH": [7.3399, -2.3268],
  "wa|GH": [10.0601, -2.5099],
  "bolgatanga|GH": [10.7856, -0.8514],
};

const COUNTRY_COORDS = {
  GH: [7.9465, -1.0232],
  NG: [9.0820, 8.6753],
  US: [39.8283, -98.5795],
  GB: [55.3781, -3.4360],
  ZA: [-30.5595, 22.9375],
  KE: [-0.0236, 37.9062],
  FR: [46.2276, 2.2137],
  DE: [51.1657, 10.4515],
  IN: [20.5937, 78.9629],
  CN: [35.8617, 104.1954],
  AE: [23.4241, 53.8478],
  CA: [56.1304, -106.3468],
};

function resolveCoords(city, countryId) {
  const key = `${(city || "").toLowerCase()}|${countryId}`;
  if (LOCATION_COORDS[key]) return LOCATION_COORDS[key];
  if (COUNTRY_COORDS[countryId]) return COUNTRY_COORDS[countryId];
  return null;
}

function ensurePulseStyles() {
  if (document.getElementById("pulse-marker-styles")) return;
  const style = document.createElement("style");
  style.id = "pulse-marker-styles";
  style.textContent = `
    .pulse-marker { position: relative; width: 16px; height: 16px; }
    .pulse-marker .dot {
      position: absolute; top: 4px; left: 4px; width: 8px; height: 8px;
      background: #059669; border-radius: 50%; box-shadow: 0 0 0 2px #fff;
    }
    .pulse-marker .ring {
      position: absolute; top: 0; left: 0; width: 16px; height: 16px;
      border-radius: 50%; background: rgba(5,150,105,0.5);
      animation: pulse-ring 1.8s ease-out infinite;
    }
    @keyframes pulse-ring {
      0% { transform: scale(0.5); opacity: 0.8; }
      100% { transform: scale(2.2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

let realtimeLeafletMap = null;
let realtimeMarkers = [];

function initRealtimeMap() {
  const mapContainer = document.getElementById("realtimeMap");
  if (!mapContainer || typeof L === "undefined" || realtimeLeafletMap) return;

  ensurePulseStyles();

  realtimeLeafletMap = L.map("realtimeMap", { worldCopyJump: true }).setView([10, 0], 3);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(realtimeLeafletMap);
}

function renderRealtimeMap(byLocation) {
  const mapContainer = document.getElementById("realtimeMap");
  if (!mapContainer) return;

  if (typeof L === "undefined") {
    console.warn("Leaflet failed to load — check the CDN <script> tag in analytics.html");
    mapContainer.innerHTML =
      '<p style="text-align:center;color:var(--text-muted,#64748b);padding:1rem;">Map unavailable — mapping library failed to load.</p>';
    return;
  }

  initRealtimeMap();
  if (!realtimeLeafletMap) return;

  realtimeMarkers.forEach((m) => realtimeLeafletMap.removeLayer(m));
  realtimeMarkers = [];

  (byLocation || []).forEach(({ countryId, country, city, activeUsers }) => {
    const coords = resolveCoords(city, countryId);
    if (!coords) return;

    const icon = L.divIcon({
      className: "",
      html: '<div class="pulse-marker"><div class="ring"></div><div class="dot"></div></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const label = city && city !== "(not set)" ? `${city}, ${country}` : country;
    const marker = L.marker(coords, { icon })
      .addTo(realtimeLeafletMap)
      .bindPopup(`<strong>${escapeHtml(label)}</strong><br>${activeUsers} active now`);

    realtimeMarkers.push(marker);
  });
}