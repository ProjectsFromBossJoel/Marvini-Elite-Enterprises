// ═══════════════════════════════════════════════════════
// MARVINI ADMIN — admin.js
// ═══════════════════════════════════════════════════════
import {
  db, auth,
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "./firebase-config.js";

// ── DEV / DEMO MODE ────────────────────────────────────
// Set DEV_MODE to false (or delete this block) once real Firebase
// Auth users exist and firebase-config.js has real project keys.
const DEV_MODE = true;
const DEMO_EMAIL = 'admin@marvini.com';
const DEMO_PASSWORD = 'marvini2026';
let isDemoSession = false;

// ── TOAST ──────────────────────────────────────────────
const toastEl = document.getElementById('toast');
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// ── MODAL HELPERS ──────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
});

// ── AUTH ───────────────────────────────────────────────
const loginScreen = document.getElementById('loginScreen');
const adminShell = document.getElementById('adminShell');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

if (DEV_MODE) {
  const hint = document.createElement('p');
  hint.style.cssText = 'text-align:center; font-size:0.78rem; color:var(--text-muted); background:var(--bg-secondary); border:1px dashed var(--border); border-radius:10px; padding:0.6rem 0.8rem; margin-bottom:1.25rem;';
  hint.innerHTML = `Demo login — <strong>${DEMO_EMAIL}</strong> / <strong>${DEMO_PASSWORD}</strong>`;
  loginForm.parentNode.insertBefore(hint, loginForm);
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  // Demo bypass — lets you test the dashboard before Firebase is configured.
  if (DEV_MODE && email === DEMO_EMAIL && password === DEMO_PASSWORD) {
    isDemoSession = true;
    enterDashboard('DM');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = DEV_MODE
      ? `Invalid email or password. (Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD})`
      : 'Invalid email or password. Please try again.';
    loginError.style.display = 'block';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  if (isDemoSession) {
    isDemoSession = false;
    exitDashboard();
  } else {
    signOut(auth);
  }
});

function enterDashboard(initials) {
  loginScreen.style.display = 'none';
  adminShell.classList.add('active');
  document.getElementById('adminAvatar').textContent = initials;
  initAllListeners();
}
function exitDashboard() {
  loginScreen.style.display = 'flex';
  adminShell.classList.remove('active');
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
}

let unsubscribers = [];
onAuthStateChanged(auth, (user) => {
  if (isDemoSession) return; // demo session isn't a real Firebase user — ignore auth events
  if (user) {
    enterDashboard((user.email || 'A').slice(0, 2).toUpperCase());
  } else {
    exitDashboard();
  }
});

// ── SIDEBAR NAV ────────────────────────────────────────
const navItems = document.querySelectorAll('.nav-item[data-panel]');
const panels = document.querySelectorAll('.panel');
const topbarTitle = document.getElementById('topbarTitle');
const topbarSub = document.getElementById('topbarSub');
const panelMeta = {
  dashboard: ['Dashboard', 'Overview of the Marvini group'],
  news: ['News', 'Manage news posts and announcements'],
  team: ['Team', 'Manage team member profiles'],
  companies: ['Companies', 'Manage subsidiary listings'],
  messages: ['Messages', 'Contact form submissions'],
  gallery: ['Gallery', 'Manage photo gallery'],
  articles: ['Articles', 'Manage articles & reports'],
  settings: ['Settings', 'Site-wide configuration'],
};

function showPanel(name) {
  panels.forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  navItems.forEach(n => n.classList.toggle('active', n.dataset.panel === name));
  const [title, sub] = panelMeta[name] || ['', ''];
  topbarTitle.textContent = title;
  topbarSub.textContent = sub;
  document.getElementById('sidebar').classList.remove('open');
}
navItems.forEach(item => item.addEventListener('click', () => showPanel(item.dataset.panel)));
document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => showPanel(btn.dataset.goto));
});
document.getElementById('mobileNavToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ── SMALL UTILS ────────────────────────────────────────
const esc = (s) => (s || '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timeAgo = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString();
};

// ═══════════════════════════════════════════════════════
// NEWS
// ═══════════════════════════════════════════════════════
let newsCache = [];
function newsTable() {
  const tbody = document.getElementById('newsTableBody');
  if (!newsCache.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No news posts yet. Add your first one.</td></tr>`; return; }
  tbody.innerHTML = newsCache.map(n => `
    <tr>
      <td><img class="row-thumb" src="${esc(n.imageUrl || '')}" onerror="this.style.visibility='hidden'" /></td>
      <td>${esc(n.title)}</td>
      <td><span class="pill pill-blue">${esc(n.tag || '—')}</span></td>
      <td>${esc(n.date || '—')}</td>
      <td><span class="pill ${n.published ? 'pill-green' : 'pill-gray'}">${n.published ? 'Published' : 'Draft'}</span></td>
      <td><div class="row-actions">
        <button class="btn btn-outline btn-sm" data-edit-news="${n.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del-news="${n.id}">Delete</button>
      </div></td>
    </tr>`).join('');
}
function bindNewsRowActions() {
  document.querySelectorAll('[data-edit-news]').forEach(b => b.addEventListener('click', () => openNewsModal(b.dataset.editNews)));
  document.querySelectorAll('[data-del-news]').forEach(b => b.addEventListener('click', () => removeDoc('news', b.dataset.delNews, 'News post deleted')));
}
function openNewsModal(id) {
  const item = id ? newsCache.find(n => n.id === id) : null;
  document.getElementById('newsModalTitle').textContent = item ? 'Edit News Post' : 'Add News Post';
  document.getElementById('newsId').value = id || '';
  document.getElementById('newsTitle').value = item?.title || '';
  document.getElementById('newsTag').value = item?.tag || '';
  document.getElementById('newsDate').value = item?.date || '';
  document.getElementById('newsImage').value = item?.imageUrl || '';
  document.getElementById('newsExcerpt').value = item?.excerpt || '';
  document.getElementById('newsPublished').checked = item ? !!item.published : true;
  openModal('newsModal');
}
document.getElementById('addNewsBtn').addEventListener('click', () => openNewsModal(null));
document.getElementById('newsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('newsId').value;
  const data = {
    title: document.getElementById('newsTitle').value.trim(),
    tag: document.getElementById('newsTag').value.trim(),
    date: document.getElementById('newsDate').value,
    imageUrl: document.getElementById('newsImage').value.trim(),
    excerpt: document.getElementById('newsExcerpt').value.trim(),
    published: document.getElementById('newsPublished').checked,
  };
  await saveDoc('news', id, data);
  closeModal('newsModal');
  toast('News post saved');
});

// ═══════════════════════════════════════════════════════
// TEAM
// ═══════════════════════════════════════════════════════
let teamCache = [];
function teamTable() {
  const tbody = document.getElementById('teamTableBody');
  if (!teamCache.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No team members yet. Add your first one.</td></tr>`; return; }
  tbody.innerHTML = teamCache.map(t => `
    <tr>
      <td><img class="row-thumb" src="${esc(t.imageUrl || '')}" style="border-radius:50%;" onerror="this.style.visibility='hidden'" /></td>
      <td>${esc(t.name)}</td>
      <td>${esc(t.role)}</td>
      <td><span class="pill pill-blue">${esc(t.company || '—')}</span></td>
      <td><span class="pill ${t.featured ? 'pill-green' : 'pill-gray'}">${t.featured ? 'Featured' : '—'}</span></td>
      <td><div class="row-actions">
        <button class="btn btn-outline btn-sm" data-edit-team="${t.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del-team="${t.id}">Delete</button>
      </div></td>
    </tr>`).join('');
}
function bindTeamRowActions() {
  document.querySelectorAll('[data-edit-team]').forEach(b => b.addEventListener('click', () => openTeamModal(b.dataset.editTeam)));
  document.querySelectorAll('[data-del-team]').forEach(b => b.addEventListener('click', () => removeDoc('team', b.dataset.delTeam, 'Team member removed')));
}
function openTeamModal(id) {
  const item = id ? teamCache.find(t => t.id === id) : null;
  document.getElementById('teamModalTitle').textContent = item ? 'Edit Team Member' : 'Add Team Member';
  document.getElementById('teamId').value = id || '';
  document.getElementById('teamName').value = item?.name || '';
  document.getElementById('teamRole').value = item?.role || '';
  document.getElementById('teamCompany').value = item?.company || 'Marvini Group';
  document.getElementById('teamImage').value = item?.imageUrl || '';
  document.getElementById('teamLinkedin').value = item?.linkedin || '';
  document.getElementById('teamTwitter').value = item?.twitter || '';
  document.getElementById('teamBio').value = item?.bio || '';
  document.getElementById('teamBioText').value = item?.bioText || '';
  document.getElementById('teamFeatured').checked = !!item?.featured;
  openModal('teamModal');
}
document.getElementById('addTeamBtn').addEventListener('click', () => openTeamModal(null));
document.getElementById('teamForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('teamId').value;
  const data = {
    name: document.getElementById('teamName').value.trim(),
    role: document.getElementById('teamRole').value.trim(),
    company: document.getElementById('teamCompany').value,
    imageUrl: document.getElementById('teamImage').value.trim(),
    linkedin: document.getElementById('teamLinkedin').value.trim(),
    twitter: document.getElementById('teamTwitter').value.trim(),
    bio: document.getElementById('teamBio').value.trim(),
    bioText: document.getElementById('teamBioText').value.trim(),
    featured: document.getElementById('teamFeatured').checked,
  };
  await saveDoc('team', id, data);
  closeModal('teamModal');
  toast('Team member saved');
});

// ═══════════════════════════════════════════════════════
// COMPANIES
// ═══════════════════════════════════════════════════════
let companiesCache = [];
function companiesTable() {
  const tbody = document.getElementById('companiesTableBody');
  if (!companiesCache.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No companies yet. Add your first subsidiary.</td></tr>`; return; }
  tbody.innerHTML = companiesCache.map(c => `
    <tr>
      <td><img class="row-thumb" src="${esc(c.iconUrl || '')}" onerror="this.style.visibility='hidden'" /></td>
      <td>${esc(c.name)}</td>
      <td><span class="pill pill-blue">${esc(c.tag || '—')}</span></td>
      <td>${c.websiteUrl ? `<a href="${esc(c.websiteUrl)}" target="_blank" style="color:var(--royal-blue);">Visit ↗</a>` : '—'}</td>
      <td><div class="row-actions">
        <button class="btn btn-outline btn-sm" data-edit-company="${c.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del-company="${c.id}">Delete</button>
      </div></td>
    </tr>`).join('');
}
function bindCompanyRowActions() {
  document.querySelectorAll('[data-edit-company]').forEach(b => b.addEventListener('click', () => openCompanyModal(b.dataset.editCompany)));
  document.querySelectorAll('[data-del-company]').forEach(b => b.addEventListener('click', () => removeDoc('companies', b.dataset.delCompany, 'Company removed')));
}
function openCompanyModal(id) {
  const item = id ? companiesCache.find(c => c.id === id) : null;
  document.getElementById('companyModalTitle').textContent = item ? 'Edit Company' : 'Add Company';
  document.getElementById('companyId').value = id || '';
  document.getElementById('companyName').value = item?.name || '';
  document.getElementById('companyTag').value = item?.tag || '';
  document.getElementById('companyIcon').value = item?.iconUrl || '';
  document.getElementById('companyDesc').value = item?.desc || '';
  document.getElementById('companyWebsite').value = item?.websiteUrl || '';
  document.getElementById('companyLearnMore').value = item?.learnMoreUrl || '';
  openModal('companyModal');
}
document.getElementById('addCompanyBtn').addEventListener('click', () => openCompanyModal(null));
document.getElementById('companyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('companyId').value;
  const data = {
    name: document.getElementById('companyName').value.trim(),
    tag: document.getElementById('companyTag').value.trim(),
    iconUrl: document.getElementById('companyIcon').value.trim(),
    desc: document.getElementById('companyDesc').value.trim(),
    websiteUrl: document.getElementById('companyWebsite').value.trim(),
    learnMoreUrl: document.getElementById('companyLearnMore').value.trim(),
  };
  await saveDoc('companies', id, data);
  closeModal('companyModal');
  toast('Company saved');
});

// ═══════════════════════════════════════════════════════
// GALLERY
// ═══════════════════════════════════════════════════════
let galleryCache = [];
function galleryTable() {
  const tbody = document.getElementById('galleryTableBody');
  if (!galleryCache.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No images yet. Add your first one.</td></tr>`; return; }
  tbody.innerHTML = galleryCache.map(g => `
    <tr>
      <td><img class="row-thumb" src="${esc(g.imageUrl || '')}" onerror="this.style.visibility='hidden'" /></td>
      <td>${esc(g.caption)}</td>
      <td><span class="pill pill-blue">${esc(g.category || '—')}</span></td>
      <td><div class="row-actions">
        <button class="btn btn-outline btn-sm" data-edit-gallery="${g.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del-gallery="${g.id}">Delete</button>
      </div></td>
    </tr>`).join('');
}
function bindGalleryRowActions() {
  document.querySelectorAll('[data-edit-gallery]').forEach(b => b.addEventListener('click', () => openGalleryModal(b.dataset.editGallery)));
  document.querySelectorAll('[data-del-gallery]').forEach(b => b.addEventListener('click', () => removeDoc('gallery', b.dataset.delGallery, 'Image removed')));
}
function openGalleryModal(id) {
  const item = id ? galleryCache.find(g => g.id === id) : null;
  document.getElementById('galleryModalTitle').textContent = item ? 'Edit Image' : 'Add Gallery Image';
  document.getElementById('galleryId').value = id || '';
  document.getElementById('galleryImage').value = item?.imageUrl || '';
  document.getElementById('galleryCaption').value = item?.caption || '';
  document.getElementById('galleryCategory').value = item?.category || '';
  openModal('galleryModal');
}
document.getElementById('addGalleryBtn').addEventListener('click', () => openGalleryModal(null));
document.getElementById('galleryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('galleryId').value;
  const data = {
    imageUrl: document.getElementById('galleryImage').value.trim(),
    caption: document.getElementById('galleryCaption').value.trim(),
    category: document.getElementById('galleryCategory').value.trim(),
  };
  await saveDoc('gallery', id, data);
  closeModal('galleryModal');
  toast('Gallery image saved');
});

// ═══════════════════════════════════════════════════════
// ARTICLES
// ═══════════════════════════════════════════════════════
let articlesCache = [];
function articlesTable() {
  const tbody = document.getElementById('articlesTableBody');
  if (!articlesCache.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No articles yet. Add your first one.</td></tr>`; return; }
  tbody.innerHTML = articlesCache.map(a => `
    <tr>
      <td><img class="row-thumb" src="${esc(a.coverImageUrl || '')}" onerror="this.style.visibility='hidden'" /></td>
      <td>${esc(a.title)}</td>
      <td style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(a.desc)}</td>
      <td><div class="row-actions">
        <button class="btn btn-outline btn-sm" data-edit-article="${a.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del-article="${a.id}">Delete</button>
      </div></td>
    </tr>`).join('');
}
function bindArticleRowActions() {
  document.querySelectorAll('[data-edit-article]').forEach(b => b.addEventListener('click', () => openArticleModal(b.dataset.editArticle)));
  document.querySelectorAll('[data-del-article]').forEach(b => b.addEventListener('click', () => removeDoc('articles', b.dataset.delArticle, 'Article removed')));
}
function openArticleModal(id) {
  const item = id ? articlesCache.find(a => a.id === id) : null;
  document.getElementById('articleModalTitle').textContent = item ? 'Edit Article' : 'Add Article';
  document.getElementById('articleId').value = id || '';
  document.getElementById('articleTitle').value = item?.title || '';
  document.getElementById('articleDesc').value = item?.desc || '';
  document.getElementById('articleCover').value = item?.coverImageUrl || '';
  document.getElementById('articlePdf').value = item?.pdfUrl || '';
  openModal('articleModal');
}
document.getElementById('addArticleBtn').addEventListener('click', () => openArticleModal(null));
document.getElementById('articleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('articleId').value;
  const data = {
    title: document.getElementById('articleTitle').value.trim(),
    desc: document.getElementById('articleDesc').value.trim(),
    coverImageUrl: document.getElementById('articleCover').value.trim(),
    pdfUrl: document.getElementById('articlePdf').value.trim(),
  };
  await saveDoc('articles', id, data);
  closeModal('articleModal');
  toast('Article saved');
});

// ═══════════════════════════════════════════════════════
// MESSAGES (read from the public contact form submissions)
// ═══════════════════════════════════════════════════════
let messagesCache = [];
function messagesList() {
  const wrap = document.getElementById('messagesList');
  const dashWrap = document.getElementById('dashRecentMessages');
  if (!messagesCache.length) {
    wrap.innerHTML = `<p style="padding:2.5rem 1.5rem; color:var(--text-muted); font-size:0.85rem; text-align:center;">No messages yet.</p>`;
    dashWrap.innerHTML = `<p style="padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No messages yet.</p>`;
    return;
  }
  wrap.innerHTML = messagesCache.map(m => `
    <div class="msg-item ${m.read ? '' : 'unread'}" data-open-msg="${m.id}">
      <div class="msg-top"><span class="msg-name">${esc(m.name)}</span><span class="msg-date">${timeAgo(m.createdAt)}</span></div>
      <div class="msg-subject">${esc(m.subject || 'General Inquiry')}</div>
      <div class="msg-preview">${esc(m.message)}</div>
    </div>`).join('');
  document.querySelectorAll('[data-open-msg]').forEach(el => el.addEventListener('click', () => openMessage(el.dataset.openMsg)));

  dashWrap.innerHTML = messagesCache.slice(0, 4).map(m => `
    <div class="msg-item ${m.read ? '' : 'unread'}" data-open-msg-dash="${m.id}">
      <div class="msg-top"><span class="msg-name">${esc(m.name)}</span><span class="msg-date">${timeAgo(m.createdAt)}</span></div>
      <div class="msg-preview">${esc(m.message)}</div>
    </div>`).join('');
  document.querySelectorAll('[data-open-msg-dash]').forEach(el => el.addEventListener('click', () => { showPanel('messages'); openMessage(el.dataset.openMsgDash); }));

  const unread = messagesCache.filter(m => !m.read).length;
  document.getElementById('badgeMessages').textContent = unread || '';
  document.getElementById('statMessages').textContent = unread;
}
let activeMessageId = null;
async function openMessage(id) {
  const m = messagesCache.find(x => x.id === id);
  if (!m) return;
  activeMessageId = id;
  document.getElementById('messageDetail').innerHTML = `
    <p><strong>${esc(m.name)}</strong> · <a href="mailto:${esc(m.email)}" style="color:var(--royal-blue);">${esc(m.email)}</a></p>
    ${m.phone ? `<p>📞 ${esc(m.phone)}</p>` : ''}
    <p style="margin-top:0.5rem;"><span class="pill pill-blue">${esc(m.subject || 'General Inquiry')}</span></p>
    <p style="margin-top:0.75rem; white-space:pre-line;">${esc(m.message)}</p>
  `;
  openModal('messageModal');
  if (!m.read) await updateDoc(doc(db, 'messages', id), { read: true });
}
document.getElementById('deleteMessageBtn').addEventListener('click', () => {
  if (activeMessageId) removeDoc('messages', activeMessageId, 'Message deleted');
  closeModal('messageModal');
});

// ═══════════════════════════════════════════════════════
// SETTINGS (config/site)
// ═══════════════════════════════════════════════════════
document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    heroStats: {
      companies: Number(document.getElementById('setCompaniesCount').value) || 0,
      industries: Number(document.getElementById('setIndustriesCount').value) || 0,
    },
    contactEmail: document.getElementById('setContactEmail').value.trim(),
    careersEmail: document.getElementById('setCareersEmail').value.trim(),
    headquarters: document.getElementById('setHQ').value.trim(),
    socials: {
      linkedin: document.getElementById('setLinkedin').value.trim(),
      twitter: document.getElementById('setTwitter').value.trim(),
      facebook: document.getElementById('setFacebook').value.trim(),
      instagram: document.getElementById('setInstagram').value.trim(),
    },
    footerAbout: document.getElementById('setFooterAbout').value.trim(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'config', 'site'), data, { merge: true });
  toast('Settings saved');
});

function loadSettings(data) {
  if (!data) return;
  document.getElementById('setCompaniesCount').value = data.heroStats?.companies ?? '';
  document.getElementById('setIndustriesCount').value = data.heroStats?.industries ?? '';
  document.getElementById('setContactEmail').value = data.contactEmail || '';
  document.getElementById('setCareersEmail').value = data.careersEmail || '';
  document.getElementById('setHQ').value = data.headquarters || '';
  document.getElementById('setLinkedin').value = data.socials?.linkedin || '';
  document.getElementById('setTwitter').value = data.socials?.twitter || '';
  document.getElementById('setFacebook').value = data.socials?.facebook || '';
  document.getElementById('setInstagram').value = data.socials?.instagram || '';
  document.getElementById('setFooterAbout').value = data.footerAbout || '';
}

// ═══════════════════════════════════════════════════════
// GENERIC SAVE / DELETE
// ═══════════════════════════════════════════════════════
async function saveDoc(col, id, data) {
  try {
    if (id) {
      await updateDoc(doc(db, col, id), data);
    } else {
      await addDoc(collection(db, col), { ...data, createdAt: serverTimestamp() });
    }
  } catch (err) {
    console.error(err);
    toast('Something went wrong — please try again');
  }
}
async function removeDoc(col, id, msg) {
  if (!confirm('Are you sure you want to delete this? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, col, id));
    toast(msg);
  } catch (err) {
    console.error(err);
    toast('Delete failed — please try again');
  }
}

// ═══════════════════════════════════════════════════════
// LISTENERS (attached once authenticated)
// ═══════════════════════════════════════════════════════
function listenCollection(name, cacheSetter, renderFn, bindFn, orderField = 'createdAt') {
  const q = query(collection(db, name), orderBy(orderField, 'desc'));
  const unsub = onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cacheSetter(items);
    renderFn();
    bindFn();
    updateDashboardStats();
  }, (err) => {
    console.error(`${name} listener error:`, err);
  });
  unsubscribers.push(unsub);
}

function updateDashboardStats() {
  document.getElementById('statNews').textContent = newsCache.length;
  document.getElementById('statTeam').textContent = teamCache.length;
  document.getElementById('statCompanies').textContent = companiesCache.length;
  document.getElementById('statGallery').textContent = galleryCache.length;
  document.getElementById('statArticles').textContent = articlesCache.length;
  document.getElementById('badgeNews').textContent = '';

  const dashNews = document.getElementById('dashRecentNews');
  if (!newsCache.length) {
    dashNews.innerHTML = `<p style="padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No news posts yet.</p>`;
  } else {
    dashNews.innerHTML = newsCache.slice(0, 4).map(n => `
      <div class="msg-item">
        <div class="msg-top"><span class="msg-name">${esc(n.title)}</span><span class="msg-date">${esc(n.date || '')}</span></div>
        <div class="msg-preview">${esc(n.excerpt || '')}</div>
      </div>`).join('');
  }
}

function initAllListeners() {
  listenCollection('news', (v) => newsCache = v, newsTable, bindNewsRowActions);
  listenCollection('team', (v) => teamCache = v, teamTable, bindTeamRowActions);
  listenCollection('companies', (v) => companiesCache = v, companiesTable, bindCompanyRowActions);
  listenCollection('gallery', (v) => galleryCache = v, galleryTable, bindGalleryRowActions);
  listenCollection('articles', (v) => articlesCache = v, articlesTable, bindArticleRowActions);
  listenCollection('messages', (v) => { messagesCache = v; }, messagesList, () => {});

  const unsubSettings = onSnapshot(doc(db, 'config', 'site'), (snap) => {
    if (snap.exists()) loadSettings(snap.data());
  }, (err) => console.error('settings listener error:', err));
  unsubscribers.push(unsubSettings);
}