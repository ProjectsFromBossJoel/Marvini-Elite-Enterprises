// js/analytics-admin.js
// Fetches 30-day GA4 visitor count from the Vercel analytics endpoint
// and displays it on the dashboard.

const statEl = document.getElementById('statVisitors30d');

if (statEl) {
  fetch('https://marvini-elite-enterprises-alpha.vercel.app/api/analytics')
    .then((res) => {
      if (!res.ok) throw new Error('Request failed');
      return res.json();
    })
    .then(({ visitors }) => {
      statEl.textContent = Number(visitors).toLocaleString();
    })
    .catch((err) => {
      console.error('Could not load analytics:', err);
      statEl.textContent = '—';
      statEl.title = 'Analytics temporarily unavailable';
    });
}