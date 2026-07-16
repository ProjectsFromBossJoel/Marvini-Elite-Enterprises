// js/messages-admin.js
// Live Contact Messages panel for /dashboard/messages.html

import {
  db,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from './firebase-config.js';

const listEl = document.getElementById('messagesList');
const statTotalEl = document.getElementById('statTotalMessages');
const statUnreadEl = document.getElementById('statUnreadMessages');
const navBadge = document.getElementById('messagesNavBadge');

const modal = document.getElementById('messageModal');
const modalSubject = document.getElementById('msgModalSubject');
const modalName = document.getElementById('msgModalName');
const modalEmail = document.getElementById('msgModalEmail');
const modalPhone = document.getElementById('msgModalPhone');
const modalDate = document.getElementById('msgModalDate');
const modalBody = document.getElementById('msgModalBody');
const modalReplyBtn = document.getElementById('msgModalReplyBtn');
const modalToggleReadBtn = document.getElementById('msgModalToggleRead');
const closeModalBtn = document.getElementById('closeMessageModal');

let currentMessages = [];
let openMessageId = null;

const SUBJECT_LABELS = {
  partnership: 'Partnership Inquiry',
  investment: 'Investment',
  careers: 'Career Opportunities',
  media: 'Media & Press',
  general: 'General Inquiry',
};
function subjectLabel(subject) {
  return SUBJECT_LABELS[subject] || subject || 'General';
}

function formatFullDate(ts) {
  if (!ts?.toDate) return '—';
  const d = ts.toDate();
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Returns { top, bottom } for the small time badge on each row
function formatTimeParts(ts) {
  if (!ts?.toDate) return { top: '—', bottom: '' };
  const d = ts.toDate();
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    const [time, ampm] = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).split(' ');
    return { top: time, bottom: ampm || '' };
  }
  return { top: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), bottom: '' };
}

function openModal(msgId) {
  const msg = currentMessages.find(m => m.id === msgId);
  if (!msg) return;
  openMessageId = msgId;

  modalSubject.textContent = `${msg.name || 'Unknown'} — ${subjectLabel(msg.subject)}`;
  modalName.textContent = msg.name || '—';
  modalEmail.textContent = msg.email || '—';
  modalEmail.href = msg.email ? `mailto:${msg.email}` : '#';
  modalPhone.textContent = msg.phone || '—';
  modalDate.textContent = formatFullDate(msg.createdAt);
  modalBody.textContent = msg.message || '';
  modalReplyBtn.href = msg.email
    ? `mailto:${msg.email}?subject=${encodeURIComponent('Re: ' + subjectLabel(msg.subject))}`
    : '#';
  modalToggleReadBtn.textContent = msg.read ? 'Mark Unread' : 'Mark Read';

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  if (!msg.read) markRead(msgId, true);
}

function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  openMessageId = null;
}

closeModalBtn?.addEventListener('click', closeModal);
modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

modalToggleReadBtn?.addEventListener('click', async () => {
  const msg = currentMessages.find(m => m.id === openMessageId);
  if (!msg) return;
  await markRead(msg.id, !msg.read);
  modalToggleReadBtn.textContent = !msg.read ? 'Mark Unread' : 'Mark Read';
});

async function markRead(id, readValue) {
  try {
    await updateDoc(doc(db, 'messages', id), { read: readValue });
  } catch (err) {
    console.error('Could not update message:', err);
  }
}

async function archiveMessage(id) {
  const msg = currentMessages.find(m => m.id === id);
  const confirmed = await uiConfirm(
    `Delete the message from ${msg?.name || 'this sender'}? This cannot be undone.`,
    { title: 'Delete Message', confirmText: 'Delete', danger: true }
  );
  if (!confirmed) return;
  try {
    await deleteDoc(doc(db, 'messages', id));
  } catch (err) {
    console.error('Could not delete message:', err);
    await uiAlert('Could not delete this message. Please try again.', { title: 'Error', danger: true });
  }
}

function renderMessages() {
  if (!listEl) return;

  if (currentMessages.length === 0) {
    listEl.innerHTML = `<p style="text-align:center;color:var(--text-muted,#64748b);padding:1.5rem;">No messages yet.</p>`;
    updateStats();
    return;
  }

  listEl.innerHTML = currentMessages.map(msg => {
    const unread = !msg.read;
    const time = formatTimeParts(msg.createdAt);
    const barColor = unread ? 'var(--royal-blue)' : 'var(--border,#e2e8f0)';
    const preview = (msg.message || '').slice(0, 90) + ((msg.message || '').length > 90 ? '…' : '');

    return `
      <div class="lesson-item" data-id="${msg.id}">
        <div class="lesson-time"><div class="t">${time.top}</div><div class="m">${time.bottom}</div></div>
        <div class="lesson-bar" style="background:${barColor}"></div>
        <div class="lesson-info" style="flex:1;">
          <strong style="display:flex;align-items:center;gap:8px;">
            ${msg.name || 'Unknown'} — ${subjectLabel(msg.subject)}
            ${unread ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--royal-blue);flex-shrink:0;"></span>' : ''}
          </strong>
          <span>${preview}</span>
        </div>
        <div class="row-actions">
          <button aria-label="View message" title="View message" class="view-msg-btn" data-id="${msg.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button aria-label="Reply" title="Reply by email" class="reply-msg-btn" data-id="${msg.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 17l-5-5 5-5"/><path d="M4 12h11a4 4 0 010 8h-1"/></svg>
          </button>
          <button aria-label="Archive" title="Delete message" class="danger archive-msg-btn" data-id="${msg.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.view-msg-btn').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id));
  });
  listEl.querySelectorAll('.reply-msg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = currentMessages.find(m => m.id === btn.dataset.id);
      if (msg?.email) {
        window.location.href = `mailto:${msg.email}?subject=${encodeURIComponent('Re: ' + subjectLabel(msg.subject))}`;
      }
    });
  });
  listEl.querySelectorAll('.archive-msg-btn').forEach(btn => {
    btn.addEventListener('click', () => archiveMessage(btn.dataset.id));
  });

  updateStats();
}

function updateStats() {
  const total = currentMessages.length;
  const unread = currentMessages.filter(m => !m.read).length;
  if (statTotalEl) statTotalEl.textContent = total;
  if (statUnreadEl) statUnreadEl.textContent = unread;
  if (navBadge) navBadge.textContent = unread;
}

// ── Live listener ──
const messagesQuery = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
onSnapshot(messagesQuery, (snapshot) => {
  currentMessages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderMessages();
}, (err) => {
  console.error('Could not load messages:', err);
  if (listEl) {
    listEl.innerHTML = `<p style="text-align:center;color:#dc2626;padding:1.5rem;">Could not load messages. Please refresh.</p>`;
  }
});

// ── Topbar "jump to inbox" icon ──
document.getElementById('jumpToInboxBtn')?.addEventListener('click', () => {
  listEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});