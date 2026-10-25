import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const uploadRoot = resolve(process.env.UPLOAD_DIR || "uploads");

export function isValidImageBuffer(buffer, mimeType) {
  if (mimeType === "image/png")
    return buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  if (mimeType === "image/jpeg")
    return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (mimeType === "image/webp")
    return (
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  return false;
}

export async function storeImage(file) {
  const extension = imageExtensions[file.mimetype];
  if (!extension || !isValidImageBuffer(file.buffer, file.mimetype)) {
    const error = new Error("Nội dung tệp không phải ảnh hợp lệ");
    error.statusCode = 415;
    throw error;
  }
  await mkdir(uploadRoot, { recursive: true });
  const fileName = `${randomUUID()}.${extension}`;
  await writeFile(resolve(uploadRoot, fileName), file.buffer, { flag: "wx" });
  return { fileName };
}

export async function removeStoredImage(fileName) {
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(fileName)) return;
  await unlink(resolve(uploadRoot, fileName)).catch(() => {});
}