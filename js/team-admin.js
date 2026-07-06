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

async function uploadPhotoToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const progressWrap = document.getElementById("teamPhotoProgress");
  const progressBar = document.getElementById("teamPhotoProgressBar");
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

let currentFilter = "all";
let currentDocs = []; // [{id, data}]

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
    document.getElementById("teamShortBio").value = editData.shortBio || "";
    document.getElementById("teamFullBio").value = editData.fullBio || "";
    document.getElementById("teamLinkedin").value = editData.linkedin || "";
    document.getElementById("teamTwitter").value = editData.twitter || "";
    document.getElementById("teamPublishNow").checked = editData.status === "published";
  } else {
    modalTitle.textContent = "Add Team Member";
    document.getElementById("teamPhoto").value = "";
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

    const data = {
      name: document.getElementById("teamName").value.trim(),
      role: document.getElementById("teamRole").value.trim(),
      category: document.getElementById("teamCategory").value,
      subsidiary: document.getElementById("teamSubsidiary").value.trim(),
      photoUrl,
      shortBio: document.getElementById("teamShortBio").value.trim(),
      fullBio: document.getElementById("teamFullBio").value.trim(),
      linkedin: document.getElementById("teamLinkedin").value.trim(),
      twitter: document.getElementById("teamTwitter").value.trim(),
      status: publishNow ? "published" : "draft",
    };

    statusEl.textContent = "Saving…";
    if (editId) {
      await updateDoc(doc(db, "team", editId), data);
    } else {
      await addDoc(collection(db, "team"), {
        ...data,
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
function buildRow(id, data) {
  const tr = document.createElement("tr");
  tr.dataset.category = data.category || "";

  const avatarUrl = data.photoUrl && data.photoUrl.trim()
    ? data.photoUrl
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || "?")}&background=1a56ff&color=fff`;

  tr.innerHTML = `
    <td><div class="student-cell"><img src="${escapeHtml(avatarUrl)}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || "?")}&background=1a56ff&color=fff'"/><div><strong>${escapeHtml(data.name || "—")}</strong><span>${escapeHtml(data.subsidiary || "")}</span></div></div></td>
    <td>${escapeHtml(data.role || "—")}</td>
    <td><span class="pill active">${escapeHtml(data.subsidiary || "—")}</span></td>
    <td><span class="pill ${data.status === "published" ? "completed" : "draft"}">${data.status === "published" ? "Published" : "Draft"}</span></td>
    <td>
      <div class="row-actions">
        <button aria-label="Edit" data-edit><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></button>
        <button aria-label="Remove" class="danger" data-remove><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
      </div>
    </td>
  `;

  tr.querySelector("[data-edit]").addEventListener("click", () => openModal(data, id));
  tr.querySelector("[data-remove]").addEventListener("click", async () => {
    if (!confirm(`Remove ${data.name || "this team member"}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "team", id));
    } catch (err) {
      console.error("Could not remove team member:", err);
      alert("Could not remove team member. Check console for details.");
    }
  });

  return tr;
}

function render() {
  tbody.innerHTML = "";
  const filtered = currentFilter === "all"
    ? currentDocs
    : currentDocs.filter((d) => d.data.category === currentFilter);

  if (filtered.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";
  filtered.forEach(({ id, data }) => tbody.appendChild(buildRow(id, data)));
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