// dashboard/js/consultancy_partners-admin.js
// Manages the "Partners" table + Add/Edit modal on the
// M-Consultancy & Training admin page. Writes to Firestore
// collection "consultancyPartners", uploads media to Cloudinary
// using the unsigned "marvini_consultancy_partners" preset.

import {
  db, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc
} from "../js/firebase-config.js";

// ---------------------------------------------------------------
// Cloudinary config — replace CLOUD_NAME with your account's cloud
// name if it differs (visible in the Cloudinary console URL / top
// left account switcher, e.g. "dilb7jd6w").
// ---------------------------------------------------------------
const CLOUD_NAME = "dilb7jd6w";
const UPLOAD_PRESET = "marvini_consultancy_partners";

async function uploadToCloudinary(file, resourceType /* 'image' | 'video' */) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error(`Cloudinary upload failed (${resourceType})`);
  const data = await res.json();
  return data.secure_url;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("partnerModal");
  const modalTitle = document.getElementById("partnerModalTitle");
  const form = document.getElementById("partnerForm");
  const statusEl = document.getElementById("partnerFormStatus");
  const submitBtn = document.getElementById("partnerSubmitBtn");
  const idInput = document.getElementById("partnerId");

  const fields = {
    name: document.getElementById("partnerName"),
    description: document.getElementById("partnerDescription"),
    ceoName: document.getElementById("partnerCeoName"),
    ceoRole: document.getElementById("partnerCeoRole"),
    website: document.getElementById("partnerWebsite"),
    mapUrl: document.getElementById("partnerMapUrl"),
    email: document.getElementById("partnerEmail"),
    phone1: document.getElementById("partnerPhone1"),
    phone2: document.getElementById("partnerPhone2"),
    logo: document.getElementById("partnerLogo"),
    ceoPhoto: document.getElementById("partnerCeoPhoto"),
    video: document.getElementById("partnerVideo"),
    image1: document.getElementById("partnerImage1"),
    image2: document.getElementById("partnerImage2"),
    landingImage: document.getElementById("partnerLandingImage"),
  };

  // Tracks existing Cloudinary URLs when editing, so we only
  // re-upload files the admin actually changed.
  let existingUrls = {};

  function openModal(partner = null) {
    form.reset();
    statusEl.textContent = "";
    existingUrls = {};

    document.querySelectorAll(
      "#partnerModal .program-image-preview-wrap"
    ).forEach(w => w.classList.remove("has-image"));

    if (partner) {
      modalTitle.textContent = "Edit Partner";
      idInput.value = partner.id;
      fields.name.value = partner.name || "";
      fields.description.value = partner.description || "";
      fields.ceoName.value = partner.ceoName || "";
      fields.ceoRole.value = partner.ceoRole || "";
      fields.website.value = partner.website || "";
      fields.mapUrl.value = partner.mapUrl || "";
      fields.email.value = partner.email || "";
      fields.phone1.value = partner.phone1 || "";
      fields.phone2.value = partner.phone2 || "";
      existingUrls = {
        logoUrl: partner.logoUrl || "",
        ceoPhotoUrl: partner.ceoPhotoUrl || "",
        videoUrl: partner.videoUrl || "",
        image1Url: partner.image1Url || "",
        image2Url: partner.image2Url || "",
        landingImageUrl: partner.landingImageUrl || "",
      };

      if (existingUrls.logoUrl) {
        document.getElementById("partnerLogoPreview").src = existingUrls.logoUrl;
        document.getElementById("partnerLogoPreviewWrap").classList.add("has-image");
      }
      if (existingUrls.ceoPhotoUrl) {
        document.getElementById("partnerCeoPhotoPreview").src = existingUrls.ceoPhotoUrl;
        document.getElementById("partnerCeoPhotoPreviewWrap").classList.add("has-image");
      }
      if (existingUrls.videoUrl) {
        document.getElementById("partnerVideoPreview").src = existingUrls.videoUrl;
        document.getElementById("partnerVideoPreviewWrap").classList.add("has-image");
      }
      if (existingUrls.image1Url) {
        document.getElementById("partnerImage1Preview").src = existingUrls.image1Url;
        document.getElementById("partnerImage1PreviewWrap").classList.add("has-image");
      }
      if (existingUrls.image2Url) {
        document.getElementById("partnerImage2Preview").src = existingUrls.image2Url;
        document.getElementById("partnerImage2PreviewWrap").classList.add("has-image");
      }
      if (existingUrls.landingImageUrl) {
        document.getElementById("partnerLandingImagePreview").src = existingUrls.landingImageUrl;
        document.getElementById("partnerLandingImagePreviewWrap").classList.add("has-image");
      }
    } else {
      modalTitle.textContent = "Add Partner";
      idInput.value = "";
    }

    modal.classList.add("open");
  }

  function closeModal() {
    modal.classList.remove("open");
  }

  document.getElementById("openPartnerBtn")?.addEventListener("click", () => openModal());
  document.getElementById("closePartnerBtn")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // ---------------- Live table ----------------
  const tableBody = document.getElementById("partnersTableBody");
  const emptyState = document.getElementById("partnersEmptyState");
  const partnersQuery = query(collection(db, "consultancyPartners"), orderBy("createdAt", "desc"));
  let partnersCache = {};

  onSnapshot(partnersQuery, (snapshot) => {
    if (snapshot.empty) {
      tableBody.innerHTML = "";
      emptyState.style.display = "block";
      partnersCache = {};
      return;
    }
    emptyState.style.display = "none";
    partnersCache = {};

    tableBody.innerHTML = snapshot.docs.map((docSnap) => {
      const p = { id: docSnap.id, ...docSnap.data() };
      partnersCache[p.id] = p;

      const logoHtml = p.logoUrl
        ? `<img src="${escapeHtml(p.logoUrl)}" alt="${escapeHtml(p.name)}" style="width:36px;height:36px;object-fit:contain;border-radius:6px;border:1px solid var(--border,#e2e8f0);" />`
        : `<span style="font-size:.7rem;color:var(--text-muted,#64748b);">No logo</span>`;

      const websiteHtml = p.website
        ? `<a href="${escapeHtml(p.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.website.replace(/^https?:\/\//, ''))}</a>`
        : `<span style="color:var(--text-muted,#64748b);">—</span>`;

      return `
        <tr data-id="${p.id}">
          <td>${logoHtml}</td>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>${escapeHtml(p.ceoName || '—')}</td>
          <td>${websiteHtml}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="btn btn-outline btn-icon" data-action="edit" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button type="button" class="btn btn-danger btn-icon" data-action="delete" title="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }, (err) => {
    console.error("Error loading partners:", err);
    tableBody.innerHTML = `<tr><td colspan="5" style="color:var(--red,#e5484d);">Couldn't load partners right now.</td></tr>`;
  });

  tableBody?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const row = btn.closest("tr[data-id]");
    const id = row?.dataset.id;
    const partner = partnersCache[id];
    if (!partner) return;

    if (btn.dataset.action === "edit") {
      openModal(partner);
    } else if (btn.dataset.action === "delete") {
      if (confirm(`Delete "${partner.name}"? This can't be undone.`)) {
        try {
          await deleteDoc(doc(db, "consultancyPartners", id));
        } catch (err) {
          console.error("Error deleting partner:", err);
          alert("Something went wrong deleting this partner. Please try again.");
        }
      }
    }
  });

  // ---------------- Form submit ----------------
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "Saving…";
    statusEl.style.color = "";
    submitBtn.disabled = true;

    try {
      const uploads = {};

      if (fields.logo.files[0]) {
        statusEl.textContent = "Uploading logo…";
        uploads.logoUrl = await uploadToCloudinary(fields.logo.files[0], "image");
      }
      if (fields.ceoPhoto.files[0]) {
        statusEl.textContent = "Uploading CEO photo…";
        uploads.ceoPhotoUrl = await uploadToCloudinary(fields.ceoPhoto.files[0], "image");
      }
      if (fields.video.files[0]) {
        statusEl.textContent = "Uploading video…";
        uploads.videoUrl = await uploadToCloudinary(fields.video.files[0], "video");
      }
      if (fields.image1.files[0]) {
        statusEl.textContent = "Uploading facility image 1…";
        uploads.image1Url = await uploadToCloudinary(fields.image1.files[0], "image");
      }
      if (fields.image2.files[0]) {
        statusEl.textContent = "Uploading facility image 2…";
        uploads.image2Url = await uploadToCloudinary(fields.image2.files[0], "image");
      }
      if (fields.landingImage.files[0]) {
        statusEl.textContent = "Uploading landing image…";
        uploads.landingImageUrl = await uploadToCloudinary(fields.landingImage.files[0], "image");
      }

      const payload = {
        name: fields.name.value.trim(),
        description: fields.description.value.trim(),
        ceoName: fields.ceoName.value.trim(),
        ceoRole: fields.ceoRole.value.trim(),
        website: fields.website.value.trim(),
        mapUrl: fields.mapUrl.value.trim(),
        email: fields.email.value.trim(),
        phone1: fields.phone1.value.trim(),
        phone2: fields.phone2.value.trim(),
        logoUrl: uploads.logoUrl ?? existingUrls.logoUrl ?? "",
        ceoPhotoUrl: uploads.ceoPhotoUrl ?? existingUrls.ceoPhotoUrl ?? "",
        videoUrl: uploads.videoUrl ?? existingUrls.videoUrl ?? "",
        image1Url: uploads.image1Url ?? existingUrls.image1Url ?? "",
        image2Url: uploads.image2Url ?? existingUrls.image2Url ?? "",
        landingImageUrl: uploads.landingImageUrl ?? existingUrls.landingImageUrl ?? "",
      };

      const existingId = idInput.value;
      statusEl.textContent = "Saving partner…";

      if (existingId) {
        await updateDoc(doc(db, "consultancyPartners", existingId), payload);
      } else {
        await addDoc(collection(db, "consultancyPartners"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      statusEl.textContent = "Saved.";
      statusEl.style.color = "var(--deep-teal,#059669)";
      setTimeout(() => { modal.classList.remove("open"); }, 700);
    } catch (err) {
      console.error("Error saving partner:", err);
      statusEl.textContent = "Something went wrong saving this partner. Please try again.";
      statusEl.style.color = "var(--red,#e5484d)";
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ---------------- Partners scroll toggle ----------------
  const scrollToggle = document.getElementById("partnersScrollToggle");
  const partnersSettingsRef = doc(db, "publicSettings", "consultancyTraining");

  onSnapshot(partnersSettingsRef, (snap) => {
    const enabled = snap.exists() ? snap.data().partnersScrollEnabled !== false : true;
    if (scrollToggle) scrollToggle.checked = enabled;
  });

  scrollToggle?.addEventListener("change", async () => {
    try {
      await setDoc(partnersSettingsRef, { partnersScrollEnabled: scrollToggle.checked }, { merge: true });
    } catch (err) {
      console.error("Error saving partners scroll setting:", err);
      scrollToggle.checked = !scrollToggle.checked; // revert on failure
    }
  });
});