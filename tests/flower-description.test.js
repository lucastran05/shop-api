import test from "node:test";
import assert from "node:assert/strict";
import {
  describeFlower,
  resetWikipediaState,
} from "../src/services/flower-description.js";

test.beforeEach(() => resetWikipediaState());

const wiki = (pages) => async (url) => {
  const lang = new URL(url).hostname.split(".")[0];
  const page = pages[lang];
  if (!page) return { ok: false, json: async () => ({}) };
  return { ok: true, json: async () => ({ type: "standard", ...page }) };
};

test("uses the Vietnamese Wikipedia title as the name and both extracts", async () => {
  const result = await describeFlower("Tithonia diversifolia", {
    english: true,
    fetchImpl: wiki({
      vi: { title: "Dã quỳ", extract: "Dã quỳ là một loài thực vật." },
      en: { title: "Tithonia diversifolia", extract: "A flowering plant." },
    }),
  });
  assert.equal(result.vietnameseName, "Dã quỳ");
  assert.deepEqual(result.description, {
    vi: "Dã quỳ là một loài thực vật.",
    en: "A flowering plant.",
  });
});

test("ignores a title equal to the scientific name and strips disambiguation", async () => {
  const same = await describeFlower("Callistephus chinensis", {
    fetchImpl: wiki({ vi: { title: "Callistephus chinensis", extract: "x" } }),
  });
  assert.equal(same.vietnameseName, "");
  const paren = await describeFlower("Hibiscus testus", {
    fetchImpl: wiki({ vi: { title: "Râm bụt (thực vật)", extract: "y" } }),
  });
  assert.equal(paren.vietnameseName, "Râm bụt");
});

test("takes the Vietnamese name from the first sentence when the title is Latin", async () => {
  const result = await describeFlower("Spiraea thunbergii", {
    fetchImpl: wiki({
      vi: {
        title: "Spiraea thunbergii",
        extract: "Tuyết mai là loài thực vật có hoa trong họ Hoa hồng.",
      },
    }),
  });
  assert.equal(result.vietnameseName, "Tuyết mai");
  const latin = await describeFlower("Spiraea japonica", {
    fetchImpl: wiki({
      vi: {
        title: "Spiraea japonica",
        extract: "Spiraea japonica là một loài thực vật có hoa trong họ Hoa hồng.",
      },
    }),
  });
  assert.equal(latin.vietnameseName, "");
});

test("falls back to the genus article for the Vietnamese name", async () => {
  const pages = {
    "Coreopsis_lanceolata": { title: "Coreopsis lanceolata", extract: "Coreopsis lanceolata là một loài." },
    Coreopsis: { title: "Chi Cúc duyên", extract: "Chi Cúc duyên là một chi." },
  };
  const result = await describeFlower("Coreopsis lanceolata", {
    fetchImpl: async (url) => {
      const { hostname, pathname } = new URL(url);
      const page = hostname.startsWith("vi.")
        ? pages[decodeURIComponent(pathname.split("/").pop())]
        : null;
      return page
        ? { ok: true, json: async () => ({ type: "standard", ...page }) }
        : { ok: false, json: async () => ({}) };
    },
  });
  assert.equal(result.vietnameseName, "Cúc duyên");
});

test("drops the 'first described' taxonomy sentence", async () => {
  const result = await describeFlower("Spiraea testii", {
    fetchImpl: wiki({
      vi: {
        title: "Tuyết mai thử",
        extract:
          "Tuyết mai là loài thực vật có hoa trong họ Hoa hồng. Loài này được Siebold ex Blume miêu tả khoa học đầu tiên năm 1826. Hoa nở vào mùa xuân.",
      },
    }),
  });
  assert.equal(
    result.description.vi,
    "Tuyết mai là loài thực vật có hoa trong họ Hoa hồng. Hoa nở vào mùa xuân.",
  );
});

test("never throws and returns empty data when Wikipedia fails", async () => {
  const result = await describeFlower("Nothing here", {
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  assert.deepEqual(result, {
    vietnameseName: "",
    description: { vi: "", en: "" },
  });
});

test("skips disambiguation pages", async () => {
  const result = await describeFlower("Ambiguous name", {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ type: "disambiguation", title: "Mơ hồ" }),
    }),
  });
  assert.equal(result.vietnameseName, "");
});

test("skips English unless asked, and backs off after HTTP 429", async () => {
  const hosts = [];
  const viOnly = await describeFlower("Bellis perennis", {
    fetchImpl: async (url) => {
      hosts.push(new URL(url).hostname);
      return { ok: true, status: 200, json: async () => ({ type: "standard", title: "Cúc tây", extract: "z" }) };
    },
  });
  assert.equal(viOnly.vietnameseName, "Cúc tây");
  assert.deepEqual(hosts, ["vi.wikipedia.org"]);

  let calls = 0;
  const limited = async () => {
    calls++;
    return { ok: false, status: 429, headers: { get: () => "120" }, json: async () => ({}) };
  };
  const first = await describeFlower("Rosa canina", { fetchImpl: limited });
  assert.equal(first.vietnameseName, "");
  const callsAfterFirst = calls;
  // Paused: no further requests, and the empty result was not cached.
  await describeFlower("Rosa gallica", { fetchImpl: limited });
  assert.equal(calls, callsAfterFirst);
  resetWikipediaState();
  const ok = await describeFlower("Rosa canina", {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ type: "standard", title: "Tầm xuân", extract: "t" }) }),
  });
  assert.equal(ok.vietnameseName, "Tầm xuân");
});
