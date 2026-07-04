// Shared behavior for every /admin page.
document.addEventListener('DOMContentLoaded', () => {

  // ── Theme toggle (persists for the session via localStorage) ──
  const themeBtn = document.getElementById('themeToggle');
  const root = document.documentElement;
  const saved = localStorage.getItem('marvini-admin-theme');
  if (saved) {
    root.dataset.theme = saved;
    if (themeBtn) themeBtn.textContent = saved === 'dark' ? '☽' : '☀';
  }
  themeBtn?.addEventListener('click', () => {
    const isDark = root.dataset.theme === 'dark';
    root.dataset.theme = isDark ? 'light' : 'dark';
    themeBtn.textContent = isDark ? '☀' : '☽';
    localStorage.setItem('marvini-admin-theme', root.dataset.theme);
  });

  // ── Simple tab/filter switching, opt-in per page via data-filter-target ──
  document.querySelectorAll('[data-admin-tabs]').forEach(group => {
    const targetSelector = group.dataset.filterTarget;
    if (!targetSelector) return;
    const tabs = group.querySelectorAll('.admin-tab');
    const items = document.querySelectorAll(targetSelector);
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.dataset.filter;
        items.forEach(item => {
          const matches = filter === 'all' || item.dataset.category === filter;
          item.style.display = matches ? '' : 'none';
        });
      });
    });
  });

  // ── Row/card delete buttons show a lightweight confirm ──
  document.querySelectorAll('[data-confirm-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr, .content-card');
      if (!row) return;
      if (confirm('Remove this item? This is a front-end demo — nothing is actually deleted yet.')) {
        row.style.opacity = '0.35';
        row.style.pointerEvents = 'none';
      }
    });
  });
});
