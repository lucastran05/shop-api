import { identifyFlower } from "../services/flower-identification.js";
import { describeFlower } from "../services/flower-description.js";
import flowerHistory from "../modules/flower/flowerHistory.repository.js";
import { BadRequestError, NotFoundError } from "../common/errors/AppError.js";
import {
  storePrivateImage,
  openPrivateImage,
  removePrivateImage,
} from "../services/upload-storage.js";

const defaultImages = {
  store: (userId, file) => storePrivateImage("flower-identifications", userId, file),
  open: openPrivateImage,
  remove: removePrivateImage,
};

// Storage cleanup is best effort: a leftover file must not fail the user request.
async function removeQuietly(images, keys) {
  for (const key of keys)
    await images.remove(key).catch((error) =>
      console.error("Không xóa được ảnh nhận diện hoa:", error.message),
    );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sendError(error, res, next) {
  // Services emit sanitized, user-safe operational messages; do not expose upstream data.
  if (error.statusCode)
    return res
      .status(error.statusCode)
      .json({ status: "error", message: error.message });
  next(error);
}

function parsePaging(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1)
    throw new BadRequestError("page phải là số nguyên từ 1");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new BadRequestError("limit phải là số nguyên từ 1 đến 50");
  return { page, limit };
}

function requireId(id) {
  if (!UUID_RE.test(String(id)))
    throw new BadRequestError("Mã lịch sử nhận diện không hợp lệ");
  return id;
}

export function createFlowerController({
  identify: identifyImpl = identifyFlower,
  describe = describeFlower,
  history = flowerHistory,
  images = defaultImages,
} = {}) {
  return {
    // POST /api/v1/flowers/identify
    async identify(req, res, next) {
      try {
        const candidates = await identifyImpl(req.file);
        // The UI shows only the best match, so only that one gets the Wikipedia lookup.
        if (candidates[0])
          Object.assign(
            candidates[0],
            await describe(candidates[0].scientificName, {
              english: req.query.lang === "en",
            }),
          );
        let historyId = null;
        if (candidates[0]) {
          // The photo is kept only together with a history entry, never on its own.
          let imageKey = null;
          try {
            imageKey = await images.store(req.user.id, req.file);
          } catch (error) {
            console.error("Không lưu được ảnh nhận diện hoa:", error.message);
          }
          try {
            historyId = (await history.create(req.user.id, candidates, imageKey)).id;
          } catch (error) {
            // A history write failure must not hide a successful identification.
            console.error("Không lưu được lịch sử nhận diện hoa:", error.message);
            if (imageKey) await removeQuietly(images, [imageKey]);
          }
        }
        res.json({ status: "success", data: { candidates, historyId } });
      } catch (error) {
        sendError(error, res, next);
      }
    },

    // GET /api/v1/flowers/history
    async listHistory(req, res, next) {
      try {
        const result = await history.list(req.user.id, parsePaging(req.query));
        res.json({
          status: "success",
          data: result.items,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            total_pages: result.totalPages,
          },
        });
      } catch (error) {
        sendError(error, res, next);
      }
    },

    // GET /api/v1/flowers/history/:id
    async getHistory(req, res, next) {
      try {
        const record = await history.findById(req.user.id, requireId(req.params.id));
        if (!record) throw new NotFoundError("Không tìm thấy lịch sử nhận diện");
        res.json({ status: "success", data: record });
      } catch (error) {
        sendError(error, res, next);
      }
    },

    // GET /api/v1/flowers/history/:id/image
    async getHistoryImage(req, res, next) {
      try {
        const key = await history.findImageKey(req.user.id, requireId(req.params.id));
        const file = key ? await images.open(key) : null;
        if (!file) throw new NotFoundError("Không tìm thấy ảnh nhận diện");
        res.set({
          "Content-Type": file.contentType,
          "Content-Length": String(file.size),
          // Personal photo: browser may cache it, shared caches must not.
          "Cache-Control": "private, max-age=86400",
        });
        file.stream.on("error", (error) => {
          if (res.headersSent) res.destroy(error);
          else next(error);
        });
        res.on("close", () => file.stream.destroy());
        file.stream.pipe(res);
      } catch (error) {
        sendError(error, res, next);
      }
    },

    // DELETE /api/v1/flowers/history/:id
    async deleteHistory(req, res, next) {
      try {
        const removed = await history.remove(req.user.id, requireId(req.params.id));
        if (!removed) throw new NotFoundError("Không tìm thấy lịch sử nhận diện");
        if (removed.imageKey) await removeQuietly(images, [removed.imageKey]);
        res.json({ status: "success", message: "Đã xóa lịch sử nhận diện" });
      } catch (error) {
        sendError(error, res, next);
      }
    },

    // DELETE /api/v1/flowers/history
    async clearHistory(req, res, next) {
      try {
        const { deleted, imageKeys } = await history.clear(req.user.id);
        await removeQuietly(images, imageKeys);
        res.json({
          status: "success",
          message: "Đã xóa toàn bộ lịch sử nhận diện",
          data: { deleted },
        });
      } catch (error) {
        sendError(error, res, next);
      }
    },
  };
}

const controller = createFlowerController();
export const {
  identify,
  listHistory,
  getHistory,
  getHistoryImage,
  deleteHistory,
  clearHistory,
} = controller;
