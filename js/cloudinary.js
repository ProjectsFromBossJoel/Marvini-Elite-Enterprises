// ══════════════════════════════════════════════════════════
// Cloudinary upload helper — unsigned upload (no backend server needed)
// ══════════════════════════════════════════════════════════
// Setup (one-time, in your Cloudinary dashboard):
//   1. Go to Settings → Upload → Upload presets → Add upload preset
//   2. Set "Signing Mode" to "Unsigned"
//   3. (Recommended) Restrict the preset to an allowed folder and
//      allowed formats (pdf, jpg, jpeg, png, webp) for security.
//   4. Copy your Cloud Name (dashboard top-left) and the preset name
//      below.
// ══════════════════════════════════════════════════════════

const CLOUD_NAME = "dilb7jd6w";
const UPLOAD_PRESET = "marvini_publications";

/**
 * Uploads a single file to Cloudinary.
 * @param {File} file - the File object from an <input type="file">
 * @param {"image"|"raw"|"auto"} resourceType - "image" for cover art,
 *        "raw" for PDFs, "auto" lets Cloudinary decide.
 * @param {string} folder - Cloudinary folder to keep uploads organized.
 * @returns {Promise<{url: string, publicId: string, format: string}>}
 */
export async function uploadToCloudinary(file, resourceType = "auto", folder = "marvini-publications") {
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  const response = await fetch(endpoint, { method: "POST", body: formData });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudinary upload failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    format: data.format,
    resourceType: data.resource_type,
    bytes: data.bytes,
  };
}