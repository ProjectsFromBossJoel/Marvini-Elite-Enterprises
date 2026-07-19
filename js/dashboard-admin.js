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

// ── Traffic/Applications chart: monthly application counts + monthly
// visitors (from GA4, via the existing /api/analytics endpoint) for the
// current year, plotted as two overlaid lines on a shared scale. ──
async function fetchMonthlyVisitors() {
  try {
    const res = await fetch("https://marvini-elite-enterprises-alpha.vercel.app/api/analytics");
    if (!res.ok) throw new Error("Request failed");
    const { monthlyVisitors } = await res.json();
    return monthlyVisitors || [];
  } catch (err) {
    console.error("Could not load monthly visitors for chart:", err);
    return [];
  }
}

function watchTrafficChart() {
  const areaPath = document.getElementById("applicationsAreaPath");
  const linePath = document.getElementById("applicationsLinePath");
  const visitorsArea = document.getElementById("visitorsAreaPath");
  const visitorsLine = document.getElementById("visitorsLinePath");
  const visitorsLegend = document.getElementById("visitorsLegendItem");
  const monthsWrap = document.getElementById("chartMonthsLabels");
  const yAxisWrap = document.getElementById("chartYAxisLabels");
  const yearSelect = document.getElementById("chartYearSelect");
  const panelTitle = document.getElementById("trafficPanelTitle") || document.querySelector(".panel-title");

  if (!areaPath || !linePath) return;

  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const CHART_TOP = 20;
  const CHART_BOTTOM = 240;
  const CHART_WIDTH = 760;
  const GRID_Y = [20, 75, 130, 185, 240]; // matches the SVG's drawn gridlines

  if (monthsWrap && !monthsWrap.dataset.built) {
    monthsWrap.innerHTML = MONTH_LABELS.map((m) => `<span>${m}</span>`).join("");
    monthsWrap.dataset.built = "true";
  }

  // Raw, unfiltered data — kept around so switching years re-renders
  // instantly from memory instead of re-querying Firestore/GA4.
  let allApplicationDocs = [];
  let allMonthlyVisitors = [];
  let selectedYear = new Date().getFullYear();

  // Populate the year dropdown: current year plus a few years back, so it's
  // never empty even before any data loads.
  if (yearSelect && !yearSelect.dataset.built) {
    const nowYear = new Date().getFullYear();
    const years = [nowYear, nowYear - 1, nowYear - 2, nowYear - 3];
    yearSelect.innerHTML = years
      .map((y) => `<option value="${y}">${y}</option>`)
      .join("");
    yearSelect.value = String(nowYear);
    yearSelect.dataset.built = "true";
    yearSelect.addEventListener("change", () => {
      selectedYear = parseInt(yearSelect.value, 10);
      render();
    });
  }

  function buildPoints(counts, maxCount) {
    const stepX = CHART_WIDTH / (counts.length - 1);
    return counts.map((count, i) => ({
      x: i * stepX,
      y: CHART_BOTTOM - (count / maxCount) * (CHART_BOTTOM - CHART_TOP),
      value: count,
    }));
  }

  // Smooth curve through the points using Catmull-Rom → cubic Bezier
  // conversion, matching the rounded look in the reference chart instead
  // of straight segment-to-segment lines.
  function smoothLineD(points) {
    if (points.length < 2) return "";
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      let cp1y = p1.y + (p2.y - p0.y) / 6;
      let cp2y = p2.y - (p3.y - p1.y) / 6;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;

      // Catmull-Rom control points can overshoot past the actual data range
      // near sharp peaks — clamp them to the chart's plot area so the curve
      // never visually exceeds the true max value.
      cp1y = Math.max(CHART_TOP, cp1y);
      cp2y = Math.max(CHART_TOP, cp2y);

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  function buildPath(counts, maxCount) {
    const points = buildPoints(counts, maxCount);
    const lineD = smoothLineD(points);
    const areaD =
      `M 0 ${CHART_BOTTOM} L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ` +
      lineD.replace(/^M[^C]*/, "") +
      ` L ${CHART_WIDTH} ${CHART_BOTTOM} Z`;
    return { lineD, areaD, points };
  }

  function renderYAxis(maxCount) {
    if (!yAxisWrap) return;
    // GRID_Y runs top→bottom; fraction-of-max runs the opposite way (1 at
    // the top gridline, 0 at the bottom one).
    const labels = GRID_Y.map((y) => {
      const fraction = (CHART_BOTTOM - y) / (CHART_BOTTOM - CHART_TOP);
      return Math.round(maxCount * fraction);
    });
    yAxisWrap.innerHTML = labels.map((n) => `<span>${n.toLocaleString()}</span>`).join("");
  }

  const svg = document.getElementById("trafficChartSvg");
  const tooltip = document.getElementById("chartTooltip");
  let markersLayer = document.getElementById("chartMarkersLayer");
  if (svg && !markersLayer) {
    markersLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    markersLayer.setAttribute("id", "chartMarkersLayer");
    svg.appendChild(markersLayer);
  }

  function renderMarkers(appPoints, visPoints) {
    if (!markersLayer) return;
    markersLayer.innerHTML = "";

    function addDots(points, color, seriesLabel) {
      points.forEach((p, i) => {
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", p.x.toFixed(1));
        dot.setAttribute("cy", p.y.toFixed(1));
        dot.setAttribute("r", "4.5");
        dot.setAttribute("fill", color);
        dot.setAttribute("stroke", "#fff");
        dot.setAttribute("stroke-width", "1.5");
        dot.style.cursor = "pointer";

        dot.addEventListener("mouseenter", (e) => showTooltip(e, seriesLabel, p.value));
        dot.addEventListener("mousemove", (e) => showTooltip(e, seriesLabel, p.value));
        dot.addEventListener("mouseleave", hideTooltip);

        markersLayer.appendChild(dot);
      });
    }

    addDots(visPoints, "#1a56ff", "Visitors");
    addDots(appPoints, "#059669", "Applications");
  }

  function showTooltip(evt, label, value) {
    if (!tooltip || !svg) return;
    const rect = svg.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    // Keep the tooltip's top edge from rendering above the chart itself —
    // flip it to appear below the point instead, once it's too close to the top.
    const tooltipAbove = y > 40;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.transform = tooltipAbove
      ? "translate(-50%, -115%)"
      : "translate(-50%, 15%)";
    tooltip.textContent = `${label}: ${Number(value).toLocaleString()}`;
    tooltip.style.display = "block";
  }

  function hideTooltip() {
    if (tooltip) tooltip.style.display = "none";
  }

  function render() {
    const appCounts = new Array(12).fill(0);
    allApplicationDocs.forEach((d) => {
      const created = d.createdAt?.toDate?.();
      if (created && created.getFullYear() === selectedYear) {
        appCounts[created.getMonth()]++;
      }
    });

    const visitorCounts = new Array(12).fill(0);
    allMonthlyVisitors.forEach(({ yearMonth, visitors }) => {
      const year = parseInt(String(yearMonth).slice(0, 4), 10);
      const month = parseInt(String(yearMonth).slice(4, 6), 10) - 1;
      if (year === selectedYear && month >= 0 && month < 12) {
        visitorCounts[month] = visitors;
      }
    });

    const maxCount = Math.max(...appCounts, ...visitorCounts, 1);

    const appPaths = buildPath(appCounts, maxCount);
    linePath.setAttribute("d", appPaths.lineD);
    areaPath.setAttribute("d", appPaths.areaD);

    let visPaths = null;
    if (visitorsArea && visitorsLine) {
      visPaths = buildPath(visitorCounts, maxCount);
      visitorsLine.setAttribute("d", visPaths.lineD);
      visitorsArea.setAttribute("d", visPaths.areaD);
    }

    renderMarkers(appPaths.points, visPaths ? visPaths.points : []);
    renderYAxis(maxCount);

    const yearTotal = appCounts.reduce((sum, c) => sum + c, 0);
    if (panelTitle) {
      panelTitle.innerHTML = `${yearTotal} <span style="font-size:.85rem;color:var(--text-muted);font-weight:600;">Applications in ${selectedYear}</span>`;
    }
  }

  onSnapshot(collection(db, "applications"), (snap) => {
    allApplicationDocs = snap.docs.map((d) => d.data());
    render();
  });

  fetchMonthlyVisitors().then((monthlyVisitors) => {
    allMonthlyVisitors = monthlyVisitors;
    if (visitorsLegend && monthlyVisitors.length) visitorsLegend.style.display = "flex";
    render();
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
      collection(db, "jobs"),
      (snap) => {
        const openCount = snap.docs.filter(
          (d) => String(d.data().status || "").trim().toLowerCase() === "open"
        ).length;
        setText("statOpenRoles", openCount);
      }
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