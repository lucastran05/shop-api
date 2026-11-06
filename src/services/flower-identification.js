import { AppError, BadRequestError } from "../common/errors/AppError.js";

// Only fixed messages leave this service: upstream errors can contain the API key URL.
export function validateFlowerImage(file) {
  if (!file?.buffer?.length)
    throw new BadRequestError("Vui lòng chọn một ảnh hoa");
  if (file.buffer.length > 10 * 1024 * 1024)
    throw new AppError("Ảnh không được vượt quá 10 MB", 413);
  const png = file.buffer
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg =
    file.buffer[0] === 255 && file.buffer[1] === 216 && file.buffer[2] === 255;
  if (
    !(png && file.mimetype === "image/png") &&
    !(jpeg && file.mimetype === "image/jpeg")
  ) {
    throw new AppError("Chỉ hỗ trợ ảnh JPEG hoặc PNG hợp lệ", 415);
  }
}

export async function identifyFlower(
  file,
  {
    fetchImpl = fetch,
    apiKey = process.env.PLANTNET_API_KEY,
    signal = AbortSignal.timeout(20000),
  } = {},
) {
  validateFlowerImage(file);
  if (!apiKey)
    throw new AppError("Chức năng nhận diện chưa được cấu hình", 503);
  const form = new FormData();
  form.append(
    "images",
    new Blob([file.buffer], { type: file.mimetype }),
    file.mimetype === "image/png" ? "flower.png" : "flower.jpg",
  );
  form.append("organs", "flower");
  let response, body;
  try {
    response = await fetchImpl(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(apiKey)}&lang=en`,
      { method: "POST", body: form, signal },
    );
    body = await response.json();
  } catch {
    throw new AppError(
      signal.aborted
        ? "Nhận diện quá thời gian chờ, vui lòng thử lại"
        : "Không kết nối được dịch vụ nhận diện",
      signal.aborted ? 504 : 502,
    );
  }
  if (response.status === 404 && body?.message === "Species not found")
    return [];
  if (response.status === 429)
    throw new AppError(
      "Dịch vụ nhận diện đã hết lượt, vui lòng thử lại sau",
      503,
    );
  if (!response.ok)
    throw new AppError("Dịch vụ nhận diện tạm thời không sẵn sàng", 502);
  if (
    !Array.isArray(body?.results) ||
    body.results.some(
      (item) =>
        !item?.species?.scientificNameWithoutAuthor ||
        typeof item.species.scientificNameWithoutAuthor !== "string" ||
        !Number.isFinite(item.score) ||
        item.score < 0 ||
        item.score > 1,
    )
  ) {
    throw new AppError("Dịch vụ nhận diện trả về dữ liệu không hợp lệ", 502);
  }
  return body.results
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ species, score }) => ({
      scientificName: species.scientificNameWithoutAuthor,
      commonNames: Array.isArray(species.commonNames)
        ? species.commonNames.filter((name) => typeof name === "string")
        : [],
      family:
        typeof species.family?.scientificNameWithoutAuthor === "string"
          ? species.family.scientificNameWithoutAuthor
          : "",
      score,
    }));
}
