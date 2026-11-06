// Tra Wikipedia theo tên khoa học để lấy tên tiếng Việt và một đoạn giới thiệu ngắn.
// Lý do: Pl@ntNet chỉ trả tên thông dụng tiếng Anh.
// Hàm này không bao giờ ném lỗi: gặp sự cố thì để trống trường tương ứng.

// Cache trong RAM, mỗi loài chỉ tra Wikipedia một lần.
const CACHE_LIMIT = 500;
const cache = new Map();

// Wikimedia yêu cầu User-Agent mô tả rõ client (nên kèm thông tin liên hệ),
// nếu thiếu hoặc gọi quá dồn dập họ có thể chặn cả IP.
const USER_AGENT =
  process.env.WIKIPEDIA_USER_AGENT ||
  "ABCShopFlowerIdentifier/1.0 (educational e-commerce project; flower identification)";

// Sau khi bị trả 429 (quá nhiều request), tạm ngừng gọi Wikipedia đến thời điểm này.
let pausedUntil = 0;
const DEFAULT_PAUSE_SECONDS = 300;

const MAX_EXTRACT_LENGTH = 420;

// Dùng trong test để mỗi test bắt đầu với trạng thái sạch.
export function resetWikipediaState() {
  cache.clear();
  pausedUntil = 0;
}

// "Chrysanthemum × morifolium  " -> "Chrysanthemum morifolium" (bỏ ký hiệu lai và khoảng trắng thừa).
function normalizeScientificName(scientificName) {
  return String(scientificName || "")
    .replace(/×\s*/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

// "Hồng (thực vật)" -> "Hồng": bỏ phần chú thích định hướng trong ngoặc ở cuối tiêu đề.
function stripDisambiguation(title) {
  return String(title || "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

// Rút gọn đoạn tóm tắt: bỏ câu phân loại học khô khan rồi cắt ở cuối câu gần nhất.
function trimExtract(text) {
  const sentences = String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=\.)\s+(?=\p{Lu})/u); // tách câu: sau dấu chấm và trước chữ in hoa
  const clean = sentences
    // "Loài này được L. miêu tả khoa học đầu tiên năm 1753." không có ích với khách mua hoa.
    .filter((sentence) => !/(miêu|mô) tả khoa học/i.test(sentence))
    .join(" ")
    .trim();

  if (clean.length <= MAX_EXTRACT_LENGTH) return clean;
  const cut = clean.slice(0, MAX_EXTRACT_LENGTH);
  const lastSentenceEnd = cut.lastIndexOf(". ");
  return lastSentenceEnd > 120
    ? cut.slice(0, lastSentenceEnd + 1)
    : cut.trimEnd() + "…";
}

// Lấy tên Việt từ câu mở đầu: "Tuyết mai là loài thực vật..." -> "Tuyết mai".
function nameFromExtract(extract, scientificKey) {
  const match = String(extract || "").match(
    /^([^,.;:()]{2,40}?)\s*(?:\(|,|\s(?:là|hay|còn gọi|hoặc)\s)/,
  );
  if (!match) return "";
  const name = match[1].trim();
  const genus = scientificKey.split(" ")[0];
  // Câu bắt đầu bằng chính tên Latin thì không phải tên Việt.
  if (name.toLowerCase().startsWith(genus)) return "";
  // Tên Latin chỉ có ký tự ASCII, tên Việt hầu như luôn có dấu.
  if (!/[^\x00-\x7F]/.test(name)) return "";
  return name;
}

// Gọi REST API tóm tắt bài của Wikipedia. Kết quả luôn có một trong ba trạng thái:
// - "found":   có bài hợp lệ, kèm { title, extract }
// - "missing": chắc chắn không có bài dùng được (404, trang định hướng...)
// - "error":   lỗi tạm thời (mạng, timeout, 5xx, 429), nên thử lại lần sau
async function fetchWikiSummary(lang, title, { fetchImpl, signal }) {
  if (Date.now() < pausedUntil) return { status: "error" };

  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`;
  try {
    const response = await fetchImpl(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Api-User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal,
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers?.get?.("retry-after"));
      const seconds =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter
          : DEFAULT_PAUSE_SECONDS;
      pausedUntil = Date.now() + seconds * 1000;
      return { status: "error" };
    }
    if (response.status >= 500) return { status: "error" };
    if (!response.ok) return { status: "missing" };

    const body = await response.json();
    // Chỉ nhận bài viết thường, bỏ trang định hướng và các loại trang khác.
    if (body?.type !== "standard" || typeof body.title !== "string")
      return { status: "missing" };

    return {
      status: "found",
      title: body.title,
      extract: trimExtract(body.extract),
    };
  } catch {
    return { status: "error" };
  }
}

// Tên Việt từ bài của chính loài đó.
// Wikipedia tiếng Việt thường redirect tên khoa học sang tiêu đề tiếng Việt;
// nếu tiêu đề vẫn là tên Latin thì thử lấy tên ở đầu câu đầu tiên.
function nameFromSpeciesPage(page, key) {
  if (page.status !== "found") return "";
  const title = stripDisambiguation(page.title);
  if (title.toLowerCase() !== key) return title;
  return nameFromExtract(page.extract, key);
}

// Tên Việt từ bài của chi (genus): "Spiraea" -> "Mơ Trân châu", "Brassica" -> "Chi Cải" -> "Cải".
function nameFromGenusPage(page, key) {
  if (page.status !== "found") return "";
  const genus = key.split(" ")[0];
  const title = stripDisambiguation(page.title);
  const titleIsLatin =
    title.toLowerCase() === genus || title.toLowerCase().startsWith(genus + " ");
  const name = title && !titleIsLatin ? title : nameFromExtract(page.extract, key);
  return name.replace(/^chi\s+/i, "").trim();
}

function saveToCache(cacheKey, result) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value); // bỏ mục cũ nhất
  cache.set(cacheKey, result);
}

export async function describeFlower(
  scientificName,
  { fetchImpl = fetch, timeoutMs = 6000, english = false } = {},
) {
  const name = normalizeScientificName(scientificName);
  if (!name) return { vietnameseName: "", description: { vi: "", en: "" } };

  const key = name.toLowerCase();
  const cacheKey = (english ? "en:" : "vi:") + key;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  // Một timeout chung cho mọi request của lần tra này.
  const options = { fetchImpl, signal: AbortSignal.timeout(timeoutMs) };

  // 1. Bài tiếng Việt, và bài tiếng Anh nếu giao diện đang ở tiếng Anh.
  const [viPage, enPage] = await Promise.all([
    fetchWikiSummary("vi", name, options),
    english ? fetchWikiSummary("en", name, options) : { status: "missing" },
  ]);
  const pages = [viPage, enPage];

  // 2. Tìm tên Việt từ bài của loài, không có thì thử bài của chi.
  let vietnameseName = nameFromSpeciesPage(viPage, key);
  const genus = name.split(" ")[0];
  if (!vietnameseName && genus.toLowerCase() !== key) {
    const genusPage = await fetchWikiSummary("vi", genus, options);
    pages.push(genusPage);
    vietnameseName = nameFromGenusPage(genusPage, key);
  }

  const result = {
    vietnameseName,
    description: {
      vi: viPage.status === "found" ? viPage.extract : "",
      en: enPage.status === "found" ? enPage.extract : "",
    },
  };

  // 3. Chỉ cache khi không có lỗi tạm thời, để lần sau còn được tra lại.
  const hadError = pages.some((page) => page.status === "error");
  if (!hadError) saveToCache(cacheKey, result);
  return result;
}
