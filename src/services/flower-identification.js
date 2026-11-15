import { AppError, BadRequestError } from "../common/errors/AppError.js";

// Gửi ảnh sang Pl@ntNet và trả về tối đa 3 loài hoa có điểm cao nhất.
// Mọi lỗi ném ra đều là thông báo cố định: lỗi gốc của Pl@ntNet có thể chứa URL kèm API key.

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const REQUEST_TIMEOUT_MS = 20000;
const MAX_RESULTS = 3;
const PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all";

// "Magic bytes": vài byte đầu file cho biết định dạng thật, không tin vào đuôi file hay MIME.
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function isPng(buffer) {
  return buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

function isJpeg(buffer) {
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

// Bước 1: kiểm tra ảnh trước khi gửi đi.
export function validateFlowerImage(file) {
  if (!file?.buffer?.length)
    throw new BadRequestError("Vui lòng chọn một ảnh hoa");

  if (file.buffer.length > MAX_IMAGE_SIZE)
    throw new AppError("Ảnh không được vượt quá 10 MB", 413);

  // MIME khai báo phải khớp với nội dung thật của file.
  const validPng = file.mimetype === "image/png" && isPng(file.buffer);
  const validJpeg = file.mimetype === "image/jpeg" && isJpeg(file.buffer);
  if (!validPng && !validJpeg)
    throw new AppError("Chỉ hỗ trợ ảnh JPEG hoặc PNG hợp lệ", 415);
}

// Bước 2: đóng gói ảnh thành multipart form theo đúng yêu cầu của Pl@ntNet.
function buildPlantNetForm(file) {
  const form = new FormData();
  const fileName = file.mimetype === "image/png" ? "flower.png" : "flower.jpg";
  form.append("images", new Blob([file.buffer], { type: file.mimetype }), fileName);
  form.append("organs", "flower"); // ảnh chụp bông hoa, không phải lá hay thân
  return form;
}

// Bước 3: gọi API. Lỗi mạng và timeout được đổi thành thông báo thân thiện.
async function callPlantNet(form, { fetchImpl, apiKey, signal }) {
  const url = `${PLANTNET_URL}?api-key=${encodeURIComponent(apiKey)}&lang=en`;
  try {
    const response = await fetchImpl(url, { method: "POST", body: form, signal });
    const body = await response.json();
    return { response, body };
  } catch {
    if (signal.aborted)
      throw new AppError("Nhận diện quá thời gian chờ, vui lòng thử lại", 504);
    throw new AppError("Không kết nối được dịch vụ nhận diện", 502);
  }
}

// Một kết quả hợp lệ phải có tên khoa học và điểm nằm trong khoảng 0..1.
function isValidResult(item) {
  const name = item?.species?.scientificNameWithoutAuthor;
  const score = item?.score;
  return (
    typeof name === "string" &&
    name !== "" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 1
  );
}

// Đổi một kết quả của Pl@ntNet sang dạng gọn mà shop dùng.
function toCandidate({ species, score }) {
  const commonNames = Array.isArray(species.commonNames)
    ? species.commonNames.filter((name) => typeof name === "string")
    : [];
  const family =
    typeof species.family?.scientificNameWithoutAuthor === "string"
      ? species.family.scientificNameWithoutAuthor
      : "";
  return {
    scientificName: species.scientificNameWithoutAuthor,
    commonNames,
    family,
    score,
  };
}

export async function identifyFlower(
  file,
  {
    fetchImpl = fetch,
    apiKey = process.env.PLANTNET_API_KEY,
    signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  } = {},
) {
  validateFlowerImage(file);
  if (!apiKey)
    throw new AppError("Chức năng nhận diện chưa được cấu hình", 503);

  const form = buildPlantNetForm(file);
  const { response, body } = await callPlantNet(form, { fetchImpl, apiKey, signal });

  // Bước 4: diễn giải phản hồi.
  // 404 "Species not found" nghĩa là Pl@ntNet xác nhận không nhận ra loài nào: không phải lỗi.
  if (response.status === 404 && body?.message === "Species not found") return [];
  if (response.status === 429)
    throw new AppError("Dịch vụ nhận diện đã hết lượt, vui lòng thử lại sau", 503);
  if (!response.ok)
    throw new AppError("Dịch vụ nhận diện tạm thời không sẵn sàng", 502);

  const results = body?.results;
  if (!Array.isArray(results) || !results.every(isValidResult))
    throw new AppError("Dịch vụ nhận diện trả về dữ liệu không hợp lệ", 502);

  // Bước 5: sắp theo điểm giảm dần, lấy 3 loài đầu.
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(toCandidate);
}
