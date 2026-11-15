import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "minio";
import { AppError } from '../common/errors/AppError.js';

const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const uploadRoot = resolve(process.env.UPLOAD_DIR || "uploads");
let minioClient;

function storageDriver() {
  const driver = process.env.UPLOAD_STORAGE || "local";
  if (!["local", "minio"].includes(driver))
    throw new AppError("Invalid UPLOAD_STORAGE", 503);
  return driver;
}

export function getObjectStorage() {
  if (!minioClient) {
    if (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY)
      throw new AppError("MinIO credentials are not configured", 503);
    minioClient = new Client({
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      region: process.env.MINIO_REGION || "us-east-1",
    });
  }
  return {
    client: minioClient,
    bucket: process.env.MINIO_BUCKET || "shop-uploads",
  };
}

export async function initializeStorage() {
  if (storageDriver() !== "minio") return;
  const { client, bucket } = getObjectStorage();
  if (!(await client.bucketExists(bucket))) {
    try {
      await client.makeBucket(bucket, process.env.MINIO_REGION || "us-east-1");
    } catch (error) {
      if (
        !["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(error.code)
      )
        throw error;
    }
  }
}

export function isValidImageBuffer(buffer, mimeType) {
  if (mimeType === "image/png")
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
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
    throw new AppError("Nội dung tệp không phải ảnh hợp lệ", 415);
  }
  const fileName = `${randomUUID()}.${extension}`;
  if (storageDriver() === "minio") {
    const { client, bucket } = getObjectStorage();
    await client.putObject(bucket, fileName, file.buffer, file.buffer.length, {
      "Content-Type": file.mimetype,
    });
  } else {
    await mkdir(uploadRoot, { recursive: true });
    await writeFile(resolve(uploadRoot, fileName), file.buffer, { flag: "wx" });
  }
  return { fileName };
}

export async function removeStoredImage(fileName) {
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(fileName)) return;
  if (storageDriver() === "minio") {
    const { client, bucket } = getObjectStorage();
    await client.removeObject(bucket, fileName);
  } else {
    await unlink(resolve(uploadRoot, fileName)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

// Private images (e.g. flower identification photos) are kept apart from public uploads:
// - minio: under a key prefix that the public /uploads/:fileName route never matches;
// - local: in a separate folder, because express.static serves all of UPLOAD_DIR.
export const privateUploadRoot = resolve(
  process.env.PRIVATE_UPLOAD_DIR || "private-uploads",
);
const PRIVATE_KEY_RE =
  /^[a-z0-9-]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const contentTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export function isPrivateImageKey(key) {
  return PRIVATE_KEY_RE.test(String(key || ""));
}

// Stores an already validated image under "<scope>/<ownerId>/<uuid>.<ext>" and returns the key.
export async function storePrivateImage(scope, ownerId, file) {
  const extension = imageExtensions[file.mimetype];
  if (!extension || !isValidImageBuffer(file.buffer, file.mimetype))
    throw new AppError("Nội dung tệp không phải ảnh hợp lệ", 415);
  const key = `${scope}/${ownerId}/${randomUUID()}.${extension}`;
  if (!isPrivateImageKey(key)) throw new AppError("Invalid private image key", 400);
  if (storageDriver() === "minio") {
    const { client, bucket } = getObjectStorage();
    await client.putObject(bucket, key, file.buffer, file.buffer.length, {
      "Content-Type": file.mimetype,
    });
  } else {
    const target = resolve(privateUploadRoot, key);
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, file.buffer, { flag: "wx" });
  }
  return key;
}

// Returns { stream, size, contentType } or null when the object no longer exists.
export async function openPrivateImage(key) {
  if (!isPrivateImageKey(key)) return null;
  const contentType = contentTypes[key.split(".").pop()];
  try {
    if (storageDriver() === "minio") {
      const { client, bucket } = getObjectStorage();
      const stat = await client.statObject(bucket, key);
      return { stream: await client.getObject(bucket, key), size: stat.size, contentType };
    }
    const path = resolve(privateUploadRoot, key);
    const { size } = await stat(path);
    return { stream: createReadStream(path), size, contentType };
  } catch (error) {
    if (["NoSuchKey", "NotFound", "NoSuchObject", "ENOENT"].includes(error.code))
      return null;
    throw new AppError("Object storage is unavailable", 503);
  }
}

export async function removePrivateImage(key) {
  if (!isPrivateImageKey(key)) return;
  if (storageDriver() === "minio") {
    const { client, bucket } = getObjectStorage();
    await client.removeObject(bucket, key);
  } else {
    await unlink(resolve(privateUploadRoot, key)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

export async function serveStoredImage(req, res, next) {
  if (storageDriver() !== "minio") return next();
  const fileName = req.params.fileName;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(fileName))
    return res.sendStatus(404);
  try {
    const { client, bucket } = getObjectStorage();
    const stat = await client.statObject(bucket, fileName);
    const stream =
      req.method === "HEAD" ? null : await client.getObject(bucket, fileName);
    const contentType = {
      jpg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    }[fileName.split(".").pop()];
    res.set({
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    if (!stream) return res.end();
    stream.on("error", (error) => {
      if (res.headersSent) res.destroy(error);
      else next(error);
    });
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    if (["NoSuchKey", "NotFound", "NoSuchObject"].includes(error.code))
      return next();
    next(new AppError("Object storage is unavailable", 503));
  }
}
