// js/adsense-admin.js
// Powers dashboard/adsense.html — fetches AdSense report data and renders it.

// ---- CONFIG: your Vercel API domain (update if you connect a custom domain) ----
const ADSENSE_API_BASE = 'https://marvini-elite-enterprises-alpha.vercel.app';
// ----------------------------------------------------------------------------------

let currentRange = 'LAST_30_DAYS';

const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');
const fmtPct = (n) => Number(n || 0).toFixed(2) + '%';

function renderSparkline(el, values, color) {
  if (!el) return;
  if (!values || values.length < 2 || values.every((v) => v === 0)) {
    el.innerHTML = '';
    return;
  }
  const w = el.clientWidth || 140, h = 28, pad = 3;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  el.setAttribute('viewBox', `0 0 ${w} ${h}`);
  el.innerHTML = `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
}

function renderTrendChart(host, timeSeries) {
  if (!host) return;
  if (!timeSeries || timeSeries.length === 0) {
    host.innerHTML = `
      <div class="adsense-chart-empty">
        <div class="es-icon">📈</div>
        <span>No earnings recorded yet for this period</span>
      </div>`;
    return;
  }
  const w = 640, h = 230, padL = 10, padB = 26, padT = 12, padR = 10;
  const values = timeSeries.map((d) => d.earnings);
  const max = Math.max(...values, 0.01);
  const stepX = (w - padL - padR) / Math.max(timeSeries.length - 1, 1);
  const pts = values.map((v, i) => {
    const x = padL + i * stepX;
    const y = padT + (h - padT - padB) * (1 - v / max);
    return [x, y];
  });
  const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${pts[pts.length - 1][0]},${h - padB} L${pts[0][0]},${h - padB} Z`;
  host.innerHTML = `
    <svg id="adsenseTrendSvg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="adsAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1a56ff" stop-opacity="0.20"/>
          <stop offset="100%" stop-color="#1a56ff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#adsAreaFill)" />
      <path d="${line}" fill="none" stroke="#1a56ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="${padL}" y="${h - 6}" font-size="10.5" fill="var(--text-muted)" font-family="Poppins">${timeSeries[0].date}</text>
      <text x="${w - padR}" y="${h - 6}" text-anchor="end" font-size="10.5" fill="var(--text-muted)" font-family="Poppins">${timeSeries[timeSeries.length - 1].date}</text>
    </svg>`;
}

function renderTable(bodyEl, rows, maxVal) {
  if (!bodyEl) return;
  if (!rows || rows.length === 0) {
    bodyEl.innerHTML = `<tr><td colspan="3"><div class="empty-state" style="padding:24px 0;"><p>No data for this period yet</p></div></td></tr>`;
    return;
  }
  bodyEl.innerHTML = rows.slice(0, 8).map((r) => `
    <tr>
      <td>
        <strong style="font-size:.83rem;">${(r.name || 'Unknown').toString().slice(0, 42)}</strong>
        <div class="row-bar-track"><div class="row-bar-fill" style="width:${maxVal ? (r.earnings / maxVal * 100).toFixed(0) : 0}%"></div></div>
      </td>
      <td>${fmtNum(r.clicks)}</td>
      <td>${fmtMoney(r.earnings)}</td>
    </tr>`).join('');
}

function showSkeletons() {
  ['adsCardEarnings', 'adsCardClicks', 'adsCardImpressions', 'adsCardCtr', 'adsCardRpm'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skel-inline"></span>';
  });
}

async function loadAdsenseReport(range) {
  showSkeletons();
  try {
    const res = await fetch(`${ADSENSE_API_BASE}/api/adsense-report?range=${range}`);
    const data = await res.json();
    if (data.error) throw new Error(data.details || data.error);

    const t = data.totals || {};
    document.getElementById('adsCardEarnings').textContent = fmtMoney(t.earnings);
    document.getElementById('adsCardClicks').textContent = fmtNum(t.clicks);
    document.getElementById('adsCardImpressions').textContent = fmtNum(t.impressions);
    document.getElementById('adsCardCtr').textContent = fmtPct(t.ctr);
    document.getElementById('adsCardRpm').textContent = fmtMoney(t.rpm);

    const ts = data.timeSeries || [];
    renderSparkline(document.getElementById('adsSparkEarnings'), ts.map((d) => d.earnings), '#ffffff');
    renderSparkline(document.getElementById('adsSparkClicks'), ts.map((d) => d.clicks), '#1a56ff');
    renderSparkline(document.getElementById('adsSparkImpressions'), ts.map((d) => d.impressions), '#1a56ff');

    renderTrendChart(document.getElementById('adsenseChartHost'), ts);

    const banner = document.getElementById('adsenseStatusBanner');
    if (banner) banner.style.display = t.earnings > 0 ? 'none' : 'flex';

    const adRows = (data.byAdUnit || []).slice().sort((a, b) => b.earnings - a.earnings);
    const pageRows = (data.byPage || []).slice().sort((a, b) => b.earnings - a.earnings);
    const maxAd = Math.max(...adRows.map((r) => r.earnings), 0.01);
    const maxPage = Math.max(...pageRows.map((r) => r.earnings), 0.01);
    renderTable(document.getElementById('adsenseAdUnitBody'), adRows, maxAd);
    renderTable(document.getElementById('adsensePageBody'), pageRows, maxPage);

    const updatedEl = document.getElementById('adsLastUpdated');
    if (updatedEl) updatedEl.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });


  } catch (err) {
    document.getElementById('adsCardEarnings').textContent = '—';
    const host = document.getElementById('adsenseChartHost');
    if (host) host.innerHTML = `<div class="adsense-chart-empty"><div class="es-icon">⚠️</div><span>Couldn't load report: ${err.message}</span></div>`;
    console.error('AdSense report error:', err);
  }
}

function stateLabel(state) {
  const map = {
    READY: 'Ready',
    GETTING_READY: 'Getting ready',
    REQUIRES_REVIEW: 'Requires review',
    NEEDS_ATTENTION: 'Needs attention',
  };
  return map[state] || state || 'Unknown';
}

function stateClass(state) {
  return 'state-' + (state || '').toLowerCase().replace(/_/g, '-');
}

async function loadAdsenseSites() {
  const body = document.getElementById('adsenseSitesBody');
  if (!body) return;
  try {
    const res = await fetch(`${ADSENSE_API_BASE}/api/adsense-sites`);
    const data = await res.json();
    if (data.error) throw new Error(data.details || data.error);
    const sites = data.sites || [];
    if (!sites.length) {
      body.innerHTML = `<tr><td colspan="3"><div class="empty-state" style="padding:24px 0;"><p>No sites found</p></div></td></tr>`;
      return;
    }
    body.innerHTML = sites.map((s) => `
      <tr>
        <td><strong style="font-size:.83rem;">${s.domain}</strong></td>
        <td><span class="site-state-pill ${stateClass(s.state)}">${stateLabel(s.state)}</span></td>
        <td>${s.autoAdsEnabled ? 'On' : 'Off'}</td>
      </tr>`).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="3"><div class="empty-state" style="padding:24px 0;"><p>Couldn't load sites: ${err.message}</p></div></td></tr>`;
    console.error('AdSense sites error:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tabGroup = document.getElementById('adsenseRangeTabs');
  if (tabGroup) {
    tabGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.admin-tab');
      if (!btn) return;
      tabGroup.querySelectorAll('.admin-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range;
      loadAdsenseReport(currentRange);
    });
  }

  loadAdsenseReport(currentRange);
  loadAdsenseSites();
});