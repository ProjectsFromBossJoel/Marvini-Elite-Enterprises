// js/dashboard-admin.js
// Populates dashboard/index.html with live data from Firestore.
//
// Assumes these collections (create/populate them as team.html, careers.html,
// and messages.html get their own admin scripts built — until then they're
// empty and everything below correctly reads 0 rather than showing invented
// numbers):
//   team          — { name, role, subsidiary, status }
//   careers       — { title, subsidiary, type, schedule, status: "open"|"draft" }
//   applications  — { applicantName, role, subsidiary, type, stage, createdAt }
//                     stage is one of: submitted | reviewed | interview | offer | hired
//   messages      — { name, subject, excerpt (or message), read: bool, createdAt }
//
// Site Visitors / traffic and Newsletter Subscribers are intentionally left
// as static placeholders in the HTML — those need Google Analytics and a
// real newsletter-signup collection respectively, neither of which exist yet.

import {
  db,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
} from "./firebase-config.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function timeAgo(date) {
  if (!date) return "";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function whenAuthReady(cb) {
  if (window.marviniUser) return cb();
  const t = setInterval(() => {
    if (window.marviniUser) {
      clearInterval(t);
      cb();
    }
  }, 50);
}

whenAuthReady(() => {
  applyGreeting();
  watchTeamCount();
  watchCareersAndApplications();
  watchMessages();
  watchNewsletter();
  watchTrafficChart();
});

// ── Traffic/Applications chart: monthly application counts for the current year ──
function watchTrafficChart() {
  const areaPath = document.getElementById("applicationsAreaPath");
  const linePath = document.getElementById("applicationsLinePath");
  const monthsWrap = document.getElementById("chartMonthsLabels");
  const panelTitle = document.querySelector(".panel-title");
  if (!areaPath || !linePath) return;

  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Chart plot area (matches the gridlines already drawn in the SVG: y 20 → 240)
  const CHART_TOP = 20;
  const CHART_BOTTOM = 240;
  const CHART_WIDTH = 760;

  if (monthsWrap && !monthsWrap.dataset.built) {
    monthsWrap.innerHTML = MONTH_LABELS.map((m) => `<span>${m}</span>`).join("");
    monthsWrap.dataset.built = "true";
  }

  onSnapshot(collection(db, "applications"), (snap) => {
    const currentYear = new Date().getFullYear();
    const counts = new Array(12).fill(0);

    snap.docs.forEach((d) => {
      const created = d.data().createdAt?.toDate?.();
      if (created && created.getFullYear() === currentYear) {
        counts[created.getMonth()]++;
      }
    });

    const maxCount = Math.max(...counts, 1); // avoid divide-by-zero when all months are empty
    const stepX = CHART_WIDTH / (counts.length - 1);

    const points = counts.map((count, i) => {
      const x = i * stepX;
      const y = CHART_BOTTOM - (count / maxCount) * (CHART_BOTTOM - CHART_TOP);
      return { x, y };
    });

    const linePathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    const areaPathD =
      `M 0 ${CHART_BOTTOM} ` +
      points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
      ` L ${CHART_WIDTH} ${CHART_BOTTOM} Z`;

    linePath.setAttribute("d", linePathD);
    areaPath.setAttribute("d", areaPathD);

    const yearTotal = counts.reduce((sum, c) => sum + c, 0);
    if (panelTitle) {
      panelTitle.innerHTML = `${yearTotal} <span style="font-size:.85rem;color:var(--text-muted);font-weight:600;">Applications This Year</span>`;
    }
  });
}

// ── Greeting: first name of the signed-in admin ─────────────────────
function applyGreeting() {
  const name = window.marviniUser?.name || "there";
  setText("heroWelcomeName", name.split(" ")[0]);
}

// ── Newsletter subscribers count ────────────────────────────────────
function watchNewsletter() {
  onSnapshot(collection(db, "newsletter"), (snap) => {
    setText("statNewsletter", snap.size);
  });
}

// ── Team members count ──────────────────────────────────────────────
function watchTeamCount() {
  onSnapshot(collection(db, "team"), (snap) => {
    setText("statTeamCount", snap.size);
  });
}

// ── Careers: open roles, application counts, pipeline stages, recent list ──
function watchCareersAndApplications() {
  // Only the main dashboard (index.html) owns #statOpenRoles here — careers.html
  // computes its own count from the "jobs" collection via careers-admin.js.
  if (document.getElementById("recentApplicationsBody")) {
    onSnapshot(
      query(collection(db, "careers"), where("status", "==", "open")),
      (snap) => setText("statOpenRoles", snap.size)
    );
  }

  onSnapshot(collection(db, "applications"), (snap) => {
    const apps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    setText("statApplications", apps.length);
    setText("statLifetimeApplications", apps.length);

    const stageCounts = { submitted: 0, reviewed: 0, interview: 0, offer: 0, hired: 0 };
    apps.forEach((a) => {
      if (stageCounts[a.stage] !== undefined) stageCounts[a.stage]++;
    });
    setText("bubbleSubmitted", stageCounts.submitted);
    setText("bubbleReviewed", stageCounts.reviewed);
    setText("bubbleInterview", stageCounts.interview);
    setText("bubbleOffer", stageCounts.offer);
    setText("bubbleHired", stageCounts.hired);
  });

  onSnapshot(
    query(collection(db, "applications"), orderBy("createdAt", "desc"), limit(5)),
    (snap) => {
      const tbody = document.getElementById("recentApplicationsBody");
      if (!tbody) return;

      if (snap.empty) {
        tbody.innerHTML =
          '<tr><td colspan="4" style="text-align:center;color:var(--text-muted,#64748b);padding:1.5rem;">No applications yet.</td></tr>';
        return;
      }

      tbody.innerHTML = snap.docs
        .map((d) => {
          const a = d.data();
          const name = a.applicantName || "—";
          return `
            <tr>
              <td><div class="student-cell"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a56ff&color=fff"/><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(a.type || "")}</span></div></div></td>
              <td>${escapeHtml(a.role || "—")}</td>
              <td>${escapeHtml(a.subsidiary || "—")}</td>
              <td><span class="pill pending">${escapeHtml(a.stage || "submitted")}</span></td>
            </tr>`;
        })
        .join("");
    }
  );
}

// ── Contact messages: total, unread, recent list ────────────────────
function watchMessages() {
  onSnapshot(collection(db, "messages"), (snap) => {
    setText("statMessagesTotal", snap.size);

    const unread = snap.docs.filter((d) => d.data().read === false).length;
    setText("statMessagesUnread", unread);
    setText("messagesNavBadge", unread);
  });

  onSnapshot(
    query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(4)),
    (snap) => {
      const wrap = document.getElementById("recentMessagesList");
      if (!wrap) return;

      if (snap.empty) {
        wrap.innerHTML =
          '<p style="text-align:center;color:var(--text-muted,#64748b);padding:1.5rem;">No messages yet.</p>';
        return;
      }

      wrap.innerHTML = snap.docs
        .map((d) => {
          const m = d.data();
          const when = m.createdAt?.toDate ? timeAgo(m.createdAt.toDate()) : "";
          return `
            <div class="lesson-item">
              <div class="lesson-time"><div class="t">${when}</div><div class="m"></div></div>
              <div class="lesson-bar" style="background:var(--royal-blue)"></div>
              <div class="lesson-info"><strong>${escapeHtml(m.name || "—")} — ${escapeHtml(m.subject || "")}</strong><span>${escapeHtml(m.excerpt || m.message || "")}</span></div>
            </div>`;
        })
        .join("");
    }
  );
}