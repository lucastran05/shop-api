// Looks up a flower on Wikipedia (vi, plus en when asked) by its scientific name.
// Pl@ntNet only returns English common names, so this fills in the Vietnamese
// name and a short description for species we have no local data for.
// Never throws: on any failure the field is simply left empty.

const CACHE_LIMIT = 500;
const cache = new Map();
// Wikimedia asks API clients for a descriptive User-Agent with contact info,
// and throttles the whole IP when it is missing or when calls come too fast.
const USER_AGENT =
  process.env.WIKIPEDIA_USER_AGENT ||
  "ABCShopFlowerIdentifier/1.0 (educational e-commerce project; flower identification)";
// After a 429 we stop calling Wikipedia for a while instead of hammering it.
let pausedUntil = 0;

export function resetWikipediaState() {
  cache.clear();
  pausedUntil = 0;
}

function trimExtract(text, max = 420) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    // Drop taxonomy boilerplate: "Loài này được L. miêu tả khoa học đầu tiên năm 1753."
    .split(/(?<=\.)\s+(?=\p{Lu})/u)
    .filter((sentence) => !/(miêu|mô) tả khoa học/i.test(sentence))
    .join(" ")
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return end > 120 ? cut.slice(0, end + 1) : cut.trimEnd() + "…";
}

// Some vi articles keep the scientific title but open with the Vietnamese name:
// "Tuyết mai là loài thực vật..." -> "Tuyết mai".
function nameFromExtract(extract, scientificKey) {
  const match = String(extract || "").match(
    /^([^,.;:()]{2,40}?)\s*(?:\(|,|\s(?:là|hay|còn gọi|hoặc)\s)/,
  );
  if (!match) return "";
  const name = match[1].trim();
  const genus = scientificKey.split(" ")[0];
  // Reject when the sentence starts with the Latin name itself.
  if (name.toLowerCase().startsWith(genus)) return "";
  // Latin binomials are plain ASCII; Vietnamese names almost always have diacritics.
  if (!/[^\x00-\x7F]/.test(name)) return "";
  return name;
}

async function wikiSummary(lang, title, { fetchImpl, signal }) {
  if (Date.now() < pausedUntil) return undefined;
  try {
    const response = await fetchImpl(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Api-User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        signal,
      },
    );
    if (response.status === 429) {
      const retry = Number(response.headers?.get?.("retry-after"));
      pausedUntil =
        Date.now() + (Number.isFinite(retry) && retry > 0 ? retry : 300) * 1000;
      return undefined;
    }
    // 5xx is temporary (retry later); anything else not ok means no article.
    if (response.status >= 500) return undefined;
    if (!response.ok) return null;
    const body = await response.json();
    // Disambiguation and other non-article pages are ignored.
    if (body?.type !== "standard" || typeof body.title !== "string")
      return null;
    return { title: body.title, extract: trimExtract(body.extract) };
  } catch {
    // undefined = network error or timeout (retry later); null = no usable article.
    return undefined;
  }
}

export async function describeFlower(
  scientificName,
  { fetchImpl = fetch, timeoutMs = 6000, english = false } = {},
) {
  const name = String(scientificName || "")
    .replace(/×\s*/g, "")
    .trim()
    .replace(/\s+/g, " ");
  const empty = { vietnameseName: "", description: { vi: "", en: "" } };
  if (!name) return empty;
  const key = name.toLowerCase();
  const cacheKey = (english ? "en:" : "vi:") + key;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const signal = AbortSignal.timeout(timeoutMs);
  const [vi, en] = await Promise.all([
    wikiSummary("vi", name, { fetchImpl, signal }),
    // English text is only needed when the shop UI is in English.
    english ? wikiSummary("en", name, { fetchImpl, signal }) : null,
  ]);
  // vi.wikipedia redirects scientific names to the Vietnamese title when one exists.
  // "Hồng (thực vật)" -> "Hồng": drop the disambiguation suffix.
  const viTitle = vi?.title.replace(/\s*\([^)]*\)\s*$/, "").trim() || "";
  let failed = vi === undefined || en === undefined;
  let vietnameseName =
    viTitle.toLowerCase() !== key ? viTitle : nameFromExtract(vi?.extract, key);
  // Last resort: the genus article, e.g. "Spiraea" -> "Mơ Trân châu", "Brassica" -> "Chi Cải".
  const genus = key.split(" ")[0];
  if (!vietnameseName && genus !== key) {
    const page = await wikiSummary("vi", name.split(" ")[0], {
      fetchImpl,
      signal,
    });
    if (page === undefined) failed = true;
    const title = page?.title.replace(/\s*\([^)]*\)\s*$/, "").trim() || "";
    const raw =
      title && title.toLowerCase() !== genus && !title.toLowerCase().startsWith(genus + " ")
        ? title
        : nameFromExtract(page?.extract, key);
    vietnameseName = raw.replace(/^chi\s+/i, "").trim();
  }
  const result = {
    vietnameseName,
    description: { vi: vi?.extract || "", en: en?.extract || "" },
  };
  // Never cache a result that hit a network error, so it is retried next time.
  if (!failed) {
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, result);
  }
  return result;
}
