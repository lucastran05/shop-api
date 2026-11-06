import { Router } from "express";
import multer from "multer";
import { AppError } from "../common/errors/AppError.js";
import { verifyAuth } from "../middlewares/auth.middleware.js";
import { rateLimiter } from "../middlewares/rateLimiter.middleware.js";
import {
  identify,
  listHistory,
  getHistory,
  getHistoryImage,
  deleteHistory,
  clearHistory,
} from "../controllers/flower.controller.js";

export const flowerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 0, parts: 1 },
  fileFilter(_req, file, callback) {
    callback(
      ["image/jpeg", "image/png"].includes(file.mimetype)
        ? null
        : new AppError("Chỉ hỗ trợ ảnh JPEG hoặc PNG", 415),
      true,
    );
  },
}).single("image");
const router = Router();
// shortcut: limiter uses process memory, use shared storage before deploying multiple instances.
router.post(
  "/identify",
  verifyAuth,
  rateLimiter({ max: 10, keyGenerator: (req) => req.user.id }),
  flowerUpload,
  identify,
);
// Identification history of the signed-in user. Photos are private and only
// streamed to their owner through /history/:id/image.
router.get("/history", verifyAuth, listHistory);
router.delete("/history", verifyAuth, clearHistory);
router.get("/history/:id", verifyAuth, getHistory);
router.get("/history/:id/image", verifyAuth, getHistoryImage);
router.delete("/history/:id", verifyAuth, deleteHistory);
export default router;
