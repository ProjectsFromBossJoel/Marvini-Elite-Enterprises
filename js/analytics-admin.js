// js/analytics-admin.js
// Fetches 30-day GA4 visitor count from the Vercel analytics endpoint
// and displays it on the dashboard.

const statEl = document.getElementById('statVisitors30d');
const statAllTimeEl = document.getElementById('statVisitorsAllTime');

if (statEl || statAllTimeEl) {
  fetch('https://marvini-elite-enterprises-alpha.vercel.app/api/analytics')
    .then((res) => {
      if (!res.ok) throw new Error('Request failed');
      return res.json();
    })
    .then(({ visitors, visitorsAllTime }) => {
      if (statEl) statEl.textContent = Number(visitors).toLocaleString();
      if (statAllTimeEl) statAllTimeEl.textContent = Number(visitorsAllTime).toLocaleString();
    })
    .catch((err) => {
      console.error('Could not load analytics:', err);
      if (statEl) { statEl.textContent = '—'; statEl.title = 'Analytics temporarily unavailable'; }
      if (statAllTimeEl) { statAllTimeEl.textContent = '—'; statAllTimeEl.title = 'Analytics temporarily unavailable'; }
    });
}