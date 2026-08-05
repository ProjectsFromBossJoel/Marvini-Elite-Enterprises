// js/landing-programs.js
// Renders a 4-card preview of "Upcoming Training Programs" on the MEE
// landing page, sourced live from the same Firestore collection as
// consultancy-training.html (consultancyPrograms). Each card links to
// the consultancy page — there's no dedicated per-program page here.

import { db, collection, query, orderBy, limit, onSnapshot } from "./firebase-config.js";

const grid = document.getElementById('landingProgramsGrid');

if (grid) {
  const CONSULTANCY_URL = 'consultancy-training.html';

  const PARTNER_TAG_PALETTE = [
    { bg: 'rgba(26,86,255,0.12)', fg: '#1a56ff' },
    { bg: 'rgba(166,84,42,0.12)', fg: '#A6542A' },
    { bg: 'rgba(79,107,79,0.14)', fg: '#3C543C' },
    { bg: 'rgba(180,83,9,0.12)', fg: '#B45309' },
    { bg: 'rgba(5,150,105,0.12)', fg: '#047857' },
  ];

  function partnerTagColor(name) {
    if (!name) return PARTNER_TAG_PALETTE[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return PARTNER_TAG_PALETTE[hash % PARTNER_TAG_PALETTE.length];
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  const programsQuery = query(
    collection(db, 'consultancyPrograms'),
    orderBy('createdAt', 'desc'),
    limit(4)
  );

  onSnapshot(programsQuery, (snapshot) => {
    const section = grid.closest('section');
    if (snapshot.empty) {
      if (section) section.style.display = 'none';
      return;
    }
    if (section) section.style.display = '';

    grid.innerHTML = snapshot.docs.map((docSnap) => {
      const p = docSnap.data();
      const imageHtml = p.coverImageUrl
        ? `<img src="${escapeHtml(p.coverImageUrl)}" alt="${escapeHtml(p.title)}" loading="lazy" />`
        : `<span class="placeholder">No image</span>`;

      let partnerHtml = '';
      if (p.partner) {
        const c = partnerTagColor(p.partner);
        partnerHtml = `<span class="programs-landing-partner" style="background:${c.bg};color:${c.fg};">${escapeHtml(p.partner)}</span>`;
      }
      const venueHtml = p.venue ? `<span>📍 ${escapeHtml(p.venue)}</span>` : '';
      const durationHtml = p.duration ? `<span>${escapeHtml(p.duration)}</span>` : '';

      return `
        <div class="programs-landing-card reveal-fade-up revealed" role="listitem" data-card-title="${escapeHtml(p.title)}">
          <div class="programs-landing-image">
            ${imageHtml}
            <span class="programs-landing-fmt">${escapeHtml(p.format || '')}</span>
          </div>
          <div class="programs-landing-body">
            <h3 class="programs-landing-title">${escapeHtml(p.title)}</h3>
            <p class="programs-landing-desc">${escapeHtml(p.description)}</p>
            <div class="programs-landing-meta">${venueHtml}${partnerHtml}${durationHtml}</div>
            <button type="button" class="btn btn-primary programs-landing-apply" data-apply-title="${escapeHtml(p.title)}">Register interest</button>
          </div>
        </div>
      `;
    }).join('');

    // Whole card (except the button) jumps straight to the programs section.
    grid.querySelectorAll('.programs-landing-card').forEach((card) => {
      card.addEventListener('click', () => {
        window.location.href = `${CONSULTANCY_URL}#programs`;
      });
    });

    // Register button jumps to the programs section AND carries the
    // program title via ?register= so consultancy-training.html can
    // auto-open the "Register interest" modal pre-filled for it.
    grid.querySelectorAll('.programs-landing-apply').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const title = btn.dataset.applyTitle || '';
        window.location.href = `${CONSULTANCY_URL}?register=${encodeURIComponent(title)}#programs`;
      });
    });
  }, (err) => {
    console.error('Error loading landing programs preview:', err);
    const section = grid.closest('section');
    if (section) section.style.display = 'none';
  });
}