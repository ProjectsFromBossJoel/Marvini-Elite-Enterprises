// js/team-admin.js
// Admin: create/edit/delete Team members (dashboard/team.html).
// Public site (index.html #team) reads the same "team" collection
// where status == "published".

import {
  db,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "./firebase-config.js";

const tbody = document.getElementById("teamTableBody");
const emptyState = document.getElementById("teamEmptyState");
const modal = document.getElementById("teamModal");
const form = document.getElementById("teamForm");
const modalTitle = document.getElementById("teamModalTitle");
const statusEl = document.getElementById("teamStatus");
const submitBtn = document.getElementById("teamSubmitBtn");

// ── Cloudinary config — same account used elsewhere on the site ──
const CLOUDINARY_CLOUD_NAME = "dilb7jd6w";
const CLOUDINARY_UPLOAD_PRESET = "team_avatar";

async function uploadPhotoToCloudinary(file, progressWrapId = "teamPhotoProgress", progressBarId = "teamPhotoProgressBar") {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const progressWrap = document.getElementById(progressWrapId);
  const progressBar = document.getElementById(progressBarId);
  progressWrap.style.display = "block";
  progressBar.style.width = "0%";

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        progressBar.style.width = Math.round((e.loaded / e.total) * 100) + "%";
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText).secure_url);
      } else {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(formData);
  });
}

// ── File picker: preview + filename ─────────────────────
const teamPhotoFile = document.getElementById("teamPhotoFile");
const teamPhotoFileName = document.getElementById("teamPhotoFileName");
const teamPhotoPreviewWrap = document.getElementById("teamPhotoPreviewWrap");
const teamPhotoPreview = document.getElementById("teamPhotoPreview");

document.getElementById("teamPhotoLabel")?.addEventListener("click", (e) => {
  // clicking the label already triggers the hidden input via <label for>,
  // but since we're not using `for=`, forward the click manually.
  if (e.target !== teamPhotoFile) teamPhotoFile.click();
});

teamPhotoFile?.addEventListener("change", () => {
  const file = teamPhotoFile.files[0];
  if (!file) return;
  teamPhotoFileName.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    teamPhotoPreview.src = ev.target.result;
    teamPhotoPreviewWrap.style.display = "block";
  };
  reader.readAsDataURL(file);
});

// ── Subsidiary logo picker: preview + filename ──────────
const teamSubsidiaryLogoFile = document.getElementById("teamSubsidiaryLogoFile");
const teamSubsidiaryLogoFileName = document.getElementById("teamSubsidiaryLogoFileName");
const teamSubsidiaryLogoPreviewWrap = document.getElementById("teamSubsidiaryLogoPreviewWrap");
const teamSubsidiaryLogoPreview = document.getElementById("teamSubsidiaryLogoPreview");

document.getElementById("teamSubsidiaryLogoLabel")?.addEventListener("click", (e) => {
  if (e.target !== teamSubsidiaryLogoFile) teamSubsidiaryLogoFile.click();
});

teamSubsidiaryLogoFile?.addEventListener("change", () => {
  const file = teamSubsidiaryLogoFile.files[0];
  if (!file) return;
  teamSubsidiaryLogoFileName.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    teamSubsidiaryLogoPreview.src = ev.target.result;
    teamSubsidiaryLogoPreviewWrap.style.display = "block";
  };
  reader.readAsDataURL(file);
});

// ── Leadership message toggle: show/hide quote field ────
const teamShowLeadership = document.getElementById("teamShowLeadership");
const teamLeadershipQuoteWrap = document.getElementById("teamLeadershipQuoteWrap");
teamShowLeadership?.addEventListener("change", () => {
  teamLeadershipQuoteWrap.style.display = teamShowLeadership.checked ? "flex" : "none";
});

// ── Bio toolbar: wrap selected textarea text in <strong> tags ──
document.querySelectorAll("[data-bold-target]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const ta = document.getElementById(btn.dataset.boldTarget);
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return; // nothing selected
    const before = ta.value.slice(0, start);
    const selected = ta.value.slice(start, end);
    const after = ta.value.slice(end);
    ta.value = `${before}<strong>${selected}</strong>${after}`;
    ta.focus();
    ta.selectionStart = start;
    ta.selectionEnd = end + "<strong></strong>".length;
  });
});

let currentFilter = "all";
let currentDocs = []; // [{id, data}]

// ── Shared ordering: explicit "order" field first (ascending),
// then unordered members fall back to createdAt (oldest first).
// Mirrors the same logic used in team-public.js so admin order
// matches what visitors see.
function compareTeamDocs(a, b) {
  const ao = typeof a.order === "number" ? a.order : Infinity;
  const bo = typeof b.order === "number" ? b.order : Infinity;
  if (ao !== bo) return ao - bo;
  const at = a.createdAt?.seconds ?? 0;
  const bt = b.createdAt?.seconds ?? 0;
  return at - bt;
}

async function moveTeamMember(id, direction) {
  const sorted = [...currentDocs].sort((a, b) => compareTeamDocs(a.data, b.data));
  const idx = sorted.findIndex((d) => d.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;

  const current = sorted[idx];
  const neighbor = sorted[swapIdx];
  try {
    await Promise.all([
      updateDoc(doc(db, "team", current.id), { order: swapIdx }),
      updateDoc(doc(db, "team", neighbor.id), { order: idx }),
    ]);
  } catch (err) {
    console.error("Could not reorder team member:", err);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ── Open / close modal ──────────────────────────────────
function openModal(editData = null, editId = null) {
  form.reset();
  document.getElementById("teamDocId").value = editId || "";
  teamPhotoFileName.textContent = "Choose an image…";
  teamPhotoPreviewWrap.style.display = "none";
  document.getElementById("teamPhotoProgress").style.display = "none";
  document.getElementById("teamPhotoProgressBar").style.width = "0%";
  teamSubsidiaryLogoFileName.textContent = "Choose a logo image…";
  teamSubsidiaryLogoPreviewWrap.style.display = "none";
  document.getElementById("teamSubsidiaryLogoProgress").style.display = "none";
  document.getElementById("teamSubsidiaryLogoProgressBar").style.width = "0%";
  document.getElementById("teamShowLeadership").checked = false;
  document.getElementById("teamLeadershipQuoteWrap").style.display = "none";
  document.getElementById("teamLeadershipQuote").value = "";
  document.getElementById("teamShowFeatured").checked = false;

  if (editData) {
    modalTitle.textContent = "Edit Team Member";
    document.getElementById("teamName").value = editData.name || "";
    document.getElementById("teamRole").value = editData.role || "";
    document.getElementById("teamCategory").value = editData.category || "";
    document.getElementById("teamSubsidiary").value = editData.subsidiary || "";
    document.getElementById("teamPhoto").value = editData.photoUrl || "";
    if (editData.photoUrl) {
      teamPhotoPreview.src = editData.photoUrl;
      teamPhotoPreviewWrap.style.display = "block";
      teamPhotoFileName.textContent = "Current photo (choose a file to replace)";
    }
    document.getElementById("teamSubsidiaryLogo").value = editData.subsidiaryLogoUrl || "";
    if (editData.subsidiaryLogoUrl) {
      teamSubsidiaryLogoPreview.src = editData.subsidiaryLogoUrl;
      teamSubsidiaryLogoPreviewWrap.style.display = "block";
      teamSubsidiaryLogoFileName.textContent = "Current logo (choose a file to replace)";
    }
    document.getElementById("teamShortBio").value = editData.shortBio || "";
    document.getElementById("teamFullBio").value = editData.fullBio || "";
    document.getElementById("teamLinkedin").value = editData.linkedin || "";
    document.getElementById("teamTwitter").value = editData.twitter || "";
    document.getElementById("teamPublishNow").checked = editData.status === "published";
    document.getElementById("teamShowLeadership").checked = !!editData.showAsLeadershipMessage;
    document.getElementById("teamLeadershipQuote").value = editData.leadershipQuote || "";
    document.getElementById("teamLeadershipQuoteWrap").style.display = editData.showAsLeadershipMessage ? "flex" : "none";
    document.getElementById("teamShowFeatured").checked = !!editData.showAsFeatured;
  } else {
    modalTitle.textContent = "Add Team Member";
    document.getElementById("teamPhoto").value = "";
    document.getElementById("teamSubsidiaryLogo").value = "";
    document.getElementById("teamPublishNow").checked = true;
  }
  statusEl.textContent = "";
  modal.classList.add("open");
}
function closeModal() {
  modal.classList.remove("open");
}

document.getElementById("openTeamBtn")?.addEventListener("click", () => openModal());
document.getElementById("closeTeamBtn")?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

// ── Submit (create or update) ───────────────────────────
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  statusEl.textContent = "Saving…";

  const editId = document.getElementById("teamDocId").value;
  const publishNow = document.getElementById("teamPublishNow").checked;

  try {
    // Upload a new photo only if the user picked one; otherwise keep
    // whatever's already in the hidden #teamPhoto field (existing URL,
    // or blank for a brand-new member with no photo).
    const file = teamPhotoFile.files[0];
    let photoUrl = document.getElementById("teamPhoto").value.trim();
    if (file) {
      statusEl.textContent = "Uploading photo…";
      photoUrl = await uploadPhotoToCloudinary(file);
    }

    const logoFile = teamSubsidiaryLogoFile.files[0];
    let subsidiaryLogoUrl = document.getElementById("teamSubsidiaryLogo").value.trim();
    if (logoFile) {
      statusEl.textContent = "Uploading subsidiary logo…";
      subsidiaryLogoUrl = await uploadPhotoToCloudinary(logoFile, "teamSubsidiaryLogoProgress", "teamSubsidiaryLogoProgressBar");
    }

    const data = {
      name: document.getElementById("teamName").value.trim(),
      role: document.getElementById("teamRole").value.trim(),
      category: document.getElementById("teamCategory").value,
      subsidiary: document.getElementById("teamSubsidiary").value.trim(),
      photoUrl,
      subsidiaryLogoUrl,
      shortBio: document.getElementById("teamShortBio").value.trim(),
      fullBio: document.getElementById("teamFullBio").value.trim(),
      linkedin: document.getElementById("teamLinkedin").value.trim(),
      twitter: document.getElementById("teamTwitter").value.trim(),
      status: publishNow ? "published" : "draft",
      showAsLeadershipMessage: document.getElementById("teamShowLeadership").checked,
      leadershipQuote: document.getElementById("teamLeadershipQuote").value.trim(),
      showAsFeatured: document.getElementById("teamShowFeatured").checked,
    };

    statusEl.textContent = "Saving…";
    if (editId) {
      await updateDoc(doc(db, "team", editId), data);
    } else {
      // New members go to the end of the current order.
      const maxOrder = currentDocs.reduce(
        (max, d) => (typeof d.data.order === "number" ? Math.max(max, d.data.order) : max),
        -1
      );
      await addDoc(collection(db, "team"), {
        ...data,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      });
    }
    statusEl.textContent = "Saved.";
    setTimeout(closeModal, 500);
  } catch (err) {
    console.error("Could not save team member:", err);
    statusEl.textContent = "⚠️ Could not save. Check console for details.";
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Render table row ─────────────────────────────────────
function buildRow(id, data, position, total) {
  const tr = document.createElement("tr");
  tr.dataset.category = data.category || "";

  const avatarUrl = data.photoUrl && data.photoUrl.trim()
    ? data.photoUrl
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || "?")}&background=1a56ff&color=fff`;

  const canReorder = currentFilter === "all";
  const atTop = position === 0;
  const atBottom = position === total - 1;

  tr.innerHTML = `
    <td>
      <div class="order-cell">
        <span class="order-num">${position + 1}</span>
        <div class="order-btns">
          <button class="order-btn" data-move="up" ${!canReorder || atTop ? "disabled" : ""} title="${canReorder ? "Move up" : "Switch to All tab to reorder"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6"/></svg></button>
          <button class="order-btn" data-move="down" ${!canReorder || atBottom ? "disabled" : ""} title="${canReorder ? "Move down" : "Switch to All tab to reorder"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg></button>
        </div>
      </div>
    </td>
    <td><div class="student-cell"><img src="${escapeHtml(avatarUrl)}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || "?")}&background=1a56ff&color=fff'"/><div><strong>${escapeHtml(data.name || "—")}</strong><span>${escapeHtml(data.subsidiary || "")}</span></div></div></td>
    <td>${escapeHtml(data.role || "—")}</td>
    <td><span class="pill active">${escapeHtml(data.subsidiary || "—")}</span></td>
    <td><span class="pill ${data.status === "published" ? "completed" : "draft"}">${data.status === "published" ? "Published" : "Draft"}</span></td>
    <td>
      <div class="row-actions">
        <button aria-label="Edit" title="Edit" data-edit><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></button>
        <button aria-label="Remove" title="Remove" class="danger" data-remove><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
      </div>
    </td>
  `;

  tr.querySelector('[data-move="up"]')?.addEventListener("click", () => moveTeamMember(id, "up"));
  tr.querySelector('[data-move="down"]')?.addEventListener("click", () => moveTeamMember(id, "down"));
  tr.querySelector("[data-edit]").addEventListener("click", () => openModal(data, id));
  tr.querySelector("[data-remove]").addEventListener("click", async () => {
    const confirmed = await uiConfirm(
      `Remove ${data.name || "this team member"}? This cannot be undone.`,
      { title: "Remove Team Member", confirmText: "Remove", danger: true }
    );
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, "team", id));
    } catch (err) {
      console.error("Could not remove team member:", err);
      await uiAlert("Could not remove team member. Check console for details.", { title: "Error", danger: true });
    }
  });

  return tr;
}

function render() {
  tbody.innerHTML = "";
  const sorted = [...currentDocs].sort((a, b) => compareTeamDocs(a.data, b.data));
  const filtered = currentFilter === "all"
    ? sorted
    : sorted.filter((d) => d.data.category === currentFilter);

  if (filtered.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";
  filtered.forEach(({ id, data }, i) => tbody.appendChild(buildRow(id, data, i, filtered.length)));
}

// ── Tab filtering (overrides admin.js's generic version since rows
// are rendered dynamically after admin.js's DOMContentLoaded already ran) ──
document.querySelectorAll("#teamTabs .admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#teamTabs .admin-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    render();
  });
});

// ── Live data ────────────────────────────────────────────
onSnapshot(query(collection(db, "team"), orderBy("createdAt", "asc")), (snap) => {
  currentDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  render();
});