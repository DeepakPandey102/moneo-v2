// Shrinks a phone photo before upload. A modern phone receipt photo is often
// 3–8 MB / 4000px wide; the AI reads receipts just as well at ~1600px, and a
// ~300 KB upload is many seconds faster on mobile data.
//
// Falls back to the original file if the browser can't decode it (e.g. HEIC
// on some desktop browsers) — the server still accepts the original.

const MAX_SIDE = 1600;
const QUALITY = 0.82;

async function decode(file) {
  if ("createImageBitmap" in window) {
    try {
      // imageOrientation keeps portrait photos upright (EXIF rotation)
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressImage(file) {
  try {
    if (!file?.type?.startsWith("image/")) return file;
    const img = await decode(file);
    const w = img.width, h = img.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    // Already small enough — don't re-encode.
    if (scale === 1 && file.size < 600 * 1024) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (img.close) img.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], (file.name || "receipt").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch (err) {
    console.warn("Image compression skipped:", err);
    return file;
  }
}
