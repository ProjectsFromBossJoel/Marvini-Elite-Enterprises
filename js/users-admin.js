// js/users-admin.js
// Powers dashboard/users.html — list, create, edit, and disable dashboard logins.
//
// IMPORTANT: createUserWithEmailAndPassword automatically signs in as the new
// user on whatever Auth instance you call it with. To avoid booting the admin
// who is currently using this page out of their own session, user creation
// runs on a throwaway *second* Firebase App instance, then that instance is
// torn down immediately after.

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  db,
  doc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  firebaseConfig,
  USERS_COLLECTION,
} from "./firebase-config.js";

const ROLE_LABELS = { admin: "Admin", hr: "HR", it_support: "IT Support" };

const DEFAULT_PAGES = {
  admin: ["dashboard","companies","team","news","publications","gallery","partners","careers","messages","analytics","settings","users"],
  hr: ["dashboard", "team", "careers", "messages"],
  it_support: ["dashboard", "companies", "news", "publications", "gallery", "partners", "analytics", "settings"],
};

const tbody = document.getElementById("usersTableBody");
const emptyState = document.getElementById("usersEmptyState");

const modal = document.getElementById("userModal");
const modalTitle = document.getElementById("userModalTitle");
const form = document.getElementById("userForm");
const uidField = document.getElementById("userUid");
const nameField = document.getElementById("userName");
const emailField = document.getElementById("userEmail");
const passwordField = document.getElementById("userPassword");
const passwordWrap = document.getElementById("userPasswordField");
const roleField = document.getElementById("userRole");
const pagesFieldset = document.getElementById("pagesFieldset");
const pageChks = () => Array.from(document.querySelectorAll(".pageChk"));
const statusBox = document.getElementById("userStatus");
const submitBtn = document.getElementById("userSubmitBtn");

let currentUsers = []; // cache of latest snapshot, for the self-protection checks

// ─────────────────────────────────────────────────────────
// Wait until auth-guard.js has resolved window.marviniUser
// ─────────────────────────────────────────────────────────
function whenReady(cb) {
  if (window.marviniUser) return cb();
  const t = setInterval(() => {
    if (window.marviniUser) {
      clearInterval(t);
      cb();
    }
  }, 50);
}

whenReady(() => {
  if (window.marviniUser.role !== "admin") {
    // Non-admins should never really reach this page (nav link is hidden),
    // but guard the data too in case of a direct link.
    document.querySelector(".main").innerHTML =
      '<div class="page-head"><div><h1>Not Authorized</h1><p>Only administrators can manage users.</p></div></div>';
    return;
  }
  initUsersPage();
});

function initUsersPage() {
  const q = query(collection(db, USERS_COLLECTION), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    currentUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTable(currentUsers);
  });

  document.getElementById("openAddUserBtn").addEventListener("click", () => openModal());
  document.getElementById("closeUserModalBtn").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  roleField.addEventListener("change", applyRoleDefaults);

  form.addEventListener("submit", handleSubmit);
}

function renderTable(users) {
  emptyState.style.display = users.length ? "none" : "block";
  tbody.innerHTML = users.map((u) => {
    const isSelf = u.id === window.marviniUser.uid;
    const statusPill = u.status === "disabled"
      ? '<span class="pill draft">Disabled</span>'
      : '<span class="pill completed">Active</span>';
    return `
      <tr data-uid="${u.id}">
        <td><div class="student-cell"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.email)}&background=1a56ff&color=fff"/><div><strong>${escapeHtml(u.name || "—")}</strong>${isSelf ? "<span>(you)</span>" : ""}</div></div></td>
        <td>${escapeHtml(u.email || "—")}</td>
        <td><span class="role-pill ${u.role}">${ROLE_LABELS[u.role] || u.role}</span></td>
        <td>${statusPill}</td>
        <td>
          <div class="row-actions">
            <button aria-label="Edit" data-action="edit" ${isSelf ? "" : ""}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button aria-label="${u.status === "disabled" ? "Enable" : "Disable"}" data-action="toggle-status" class="${u.status === "disabled" ? "" : "danger"}" ${isSelf ? "disabled title=\"You can't disable your own account\"" : ""}>
              ${u.status === "disabled"
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg>'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const uid = e.currentTarget.closest("tr").dataset.uid;
      const u = currentUsers.find((x) => x.id === uid);
      if (u) openModal(u);
    });
  });

  tbody.querySelectorAll('[data-action="toggle-status"]').forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", async (e) => {
      const uid = e.currentTarget.closest("tr").dataset.uid;
      const u = currentUsers.find((x) => x.id === uid);
      if (!u) return;
      const nextStatus = u.status === "disabled" ? "active" : "disabled";
      if (!confirm(`${nextStatus === "disabled" ? "Disable" : "Re-enable"} dashboard access for ${u.name || u.email}?`)) return;
      await updateDoc(doc(db, USERS_COLLECTION, uid), { status: nextStatus });
    });
  });
}

function openModal(user = null) {
  form.reset();
  statusBox.textContent = "";

  if (user) {
    modalTitle.textContent = "Edit User";
    uidField.value = user.id;
    nameField.value = user.name || "";
    emailField.value = user.email || "";
    emailField.disabled = true; // email changes require re-auth; keep out of scope
    passwordWrap.style.display = "none";
    passwordField.required = false;
    roleField.value = user.role || "it_support";
    setCheckedPages(user.pages || DEFAULT_PAGES[user.role] || []);
    submitBtn.textContent = "Save Changes";
  } else {
    modalTitle.textContent = "Add User";
    uidField.value = "";
    emailField.disabled = false;
    passwordWrap.style.display = "flex";
    passwordField.required = true;
    roleField.value = "it_support";
    setCheckedPages(DEFAULT_PAGES.it_support);
    submitBtn.textContent = "Create User";
  }

  applyRoleDefaults(); // sync pages-fieldset enabled/disabled state to the role
  modal.classList.add("open");
}

function closeModal() {
  modal.classList.remove("open");
}

function applyRoleDefaults() {
  const role = roleField.value;
  if (role === "admin") {
    setCheckedPages(DEFAULT_PAGES.admin);
    pagesFieldset.classList.add("disabled");
  } else {
    pagesFieldset.classList.remove("disabled");
    // Only auto-fill defaults when creating a brand-new user (no uid yet)
    if (!uidField.value) setCheckedPages(DEFAULT_PAGES[role] || []);
  }
}

function setCheckedPages(pages) {
  pageChks().forEach((chk) => { chk.checked = pages.includes(chk.value); });
}

function getCheckedPages() {
  return pageChks().filter((c) => c.checked).map((c) => c.value);
}

async function handleSubmit(e) {
  e.preventDefault();
  submitBtn.disabled = true;
  statusBox.textContent = "";

  const uid = uidField.value;
  const name = nameField.value.trim();
  const role = roleField.value;
  const pages = role === "admin" ? DEFAULT_PAGES.admin : getCheckedPages();

  try {
    if (uid) {
      // Editing an existing user — Firestore doc only.
      await updateDoc(doc(db, USERS_COLLECTION, uid), { name, role, pages });
      statusBox.textContent = "User updated.";
    } else {
      // Creating a brand-new login — needs Auth account + Firestore doc.
      const email = emailField.value.trim();
      const password = passwordField.value;

      const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        await setDoc(doc(db, USERS_COLLECTION, cred.user.uid), {
          name,
          email,
          role,
          pages,
          status: "active",
          createdAt: serverTimestamp(),
        });
      } finally {
        await secondarySignOut(secondaryAuth).catch(() => {});
        await deleteApp(secondaryApp).catch(() => {});
      }
      statusBox.textContent = "User created.";
    }

    setTimeout(closeModal, 700);
  } catch (err) {
    console.error(err);
    statusBox.textContent = "Error: " + (err.message || "Something went wrong.");
  }

  submitBtn.disabled = false;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}