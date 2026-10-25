import multer from "multer";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 3,
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP");
      error.statusCode = 415;
      return callback(error);
    }
    callback(null, true);
  },
});

export { allowedMimeTypes };