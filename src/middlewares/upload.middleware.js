import multer from "multer";
import { AppError } from "../common/errors/AppError.js";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 3,
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype))
      return callback(new AppError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP", 415));
    callback(null, true);
  },
});
