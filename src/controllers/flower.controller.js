import { identifyFlower } from "../services/flower-identification.js";
import { describeFlower } from "../services/flower-description.js";
import flowerHistory from "../modules/flower/flowerHistory.repository.js";
import { BadRequestError, NotFoundError } from "../common/errors/AppError.js";
import {
  storePrivateImage,
  openPrivateImage,
  removePrivateImage,
} from "../services/upload-storage.js";

// Controller cho nhận diện hoa và lịch sử nhận diện.
// Các phụ thuộc (identify, describe, history, images) được truyền vào createFlowerController
// để test thay bằng bản giả mà không cần Pl@ntNet, Wikipedia, database hay MinIO.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ảnh nhận diện là ảnh riêng tư, lưu dưới thư mục "flower-identifications/<userId>/".
const privateImages = {
  store: (userId, file) =>
    storePrivateImage("flower-identifications", userId, file),
  open: openPrivateImage,
  remove: removePrivateImage,
};

// Lỗi có statusCode là lỗi nghiệp vụ đã có thông báo an toàn, trả thẳng cho client.
// Lỗi khác (bug, lỗi DB...) chuyển cho error handler chung của Express.
function sendError(error, res, next) {
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
  images = privateImages,
} = {}) {
  // Xóa file ảnh trong storage. Chỉ ghi log khi lỗi: file sót lại không được làm hỏng request.
  async function removeImagesQuietly(keys) {
    for (const key of keys) {
      try {
        await images.remove(key);
      } catch (error) {
        console.error("Không xóa được ảnh nhận diện hoa:", error.message);
      }
    }
  }

  // Lưu ảnh + kết quả vào lịch sử, trả về id bản ghi (hoặc null nếu lưu thất bại).
  // Lưu ảnh lỗi: vẫn lưu kết quả, chỉ là không có ảnh.
  // Lưu bản ghi lỗi: xóa luôn ảnh vừa lưu để không còn file mồ côi.
  // Không ném lỗi: kết quả nhận diện vẫn phải đến tay người dùng.
  async function saveToHistory(userId, candidates, file) {
    let imageKey = null;
    try {
      imageKey = await images.store(userId, file);
    } catch (error) {
      console.error("Không lưu được ảnh nhận diện hoa:", error.message);
    }

    try {
      const record = await history.create(userId, candidates, imageKey);
      return record.id;
    } catch (error) {
      console.error("Không lưu được lịch sử nhận diện hoa:", error.message);
      if (imageKey) await removeImagesQuietly([imageKey]);
      return null;
    }
  }

  return {
    // POST /api/v1/flowers/identify
    async identify(req, res, next) {
      try {
        // 1. Nhận diện bằng Pl@ntNet (tối đa 3 loài, điểm giảm dần).
        const candidates = await identifyImpl(req.file);
        const best = candidates[0];

        let historyId = null;
        if (best) {
          // 2. Giao diện chỉ hiện loài đứng đầu, nên chỉ tra Wikipedia cho loài đó.
          const info = await describe(best.scientificName, {
            english: req.query.lang === "en",
          });
          Object.assign(best, info); // thêm vietnameseName và description

          // 3. Lưu ảnh và kết quả vào lịch sử của người dùng.
          historyId = await saveToHistory(req.user.id, candidates, req.file);
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
        const id = requireId(req.params.id);
        const record = await history.findById(req.user.id, id);
        if (!record) throw new NotFoundError("Không tìm thấy lịch sử nhận diện");
        res.json({ status: "success", data: record });
      } catch (error) {
        sendError(error, res, next);
      }
    },

    // GET /api/v1/flowers/history/:id/image
    // Stream ảnh từ storage thẳng về client, không đọc cả file vào RAM.
    async getHistoryImage(req, res, next) {
      try {
        const id = requireId(req.params.id);
        // Truy vấn lọc theo user_id: người khác nhận 404 như thể ảnh không tồn tại.
        const imageKey = await history.findImageKey(req.user.id, id);
        const file = imageKey ? await images.open(imageKey) : null;
        if (!file) throw new NotFoundError("Không tìm thấy ảnh nhận diện");

        res.set({
          "Content-Type": file.contentType,
          "Content-Length": String(file.size),
          // Ảnh cá nhân: trình duyệt được cache, proxy/CDN dùng chung thì không.
          "Cache-Control": "private, max-age=86400",
        });
        file.stream.on("error", (error) => {
          if (res.headersSent) res.destroy(error);
          else next(error);
        });
        res.on("close", () => file.stream.destroy()); // client ngắt thì dừng đọc file
        file.stream.pipe(res);
      } catch (error) {
        sendError(error, res, next);
      }
    },

    // DELETE /api/v1/flowers/history/:id
    async deleteHistory(req, res, next) {
      try {
        const id = requireId(req.params.id);
        const removed = await history.remove(req.user.id, id);
        if (!removed) throw new NotFoundError("Không tìm thấy lịch sử nhận diện");
        if (removed.imageKey) await removeImagesQuietly([removed.imageKey]);
        res.json({ status: "success", message: "Đã xóa lịch sử nhận diện" });
      } catch (error) {
        sendError(error, res, next);
      }
    },

    // DELETE /api/v1/flowers/history
    async clearHistory(req, res, next) {
      try {
        const { deleted, imageKeys } = await history.clear(req.user.id);
        await removeImagesQuietly(imageKeys);
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

// Instance dùng thật trong routes, với các phụ thuộc mặc định.
export const {
  identify,
  listHistory,
  getHistory,
  getHistoryImage,
  deleteHistory,
  clearHistory,
} = createFlowerController();
