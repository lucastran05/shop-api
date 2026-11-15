import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createFlowerController } from "../src/controllers/flower.controller.js";

const require_stream = () => createRequire(import.meta.url)("node:stream");

const USER = { id: "11111111-1111-1111-1111-111111111111" };
const OTHER = { id: "22222222-2222-2222-2222-222222222222" };
const ID = "33333333-3333-3333-3333-333333333333";

// In-memory stand-in for FlowerHistoryRepository with the same owner scoping.
function memoryHistory() {
  const rows = [];
  return {
    rows,
    async create(userId, candidates, imageKey = null) {
      const record = { id: rows.length ? `${ID.slice(0, -1)}${rows.length}` : ID, userId, ...candidates[0], candidates, imageKey, hasImage: Boolean(imageKey) };
      rows.push(record);
      return record;
    },
    async list(userId, { page, limit }) {
      const mine = rows.filter((r) => r.userId === userId);
      return { items: mine.slice((page - 1) * limit, page * limit), page, limit, total: mine.length, totalPages: Math.max(1, Math.ceil(mine.length / limit)) };
    },
    async findImageKey(userId, id) {
      const row = rows.find((r) => r.id === id && r.userId === userId);
      return row ? row.imageKey : undefined;
    },
    async findById(userId, id) {
      return rows.find((r) => r.id === id && r.userId === userId) || null;
    },
    async remove(userId, id) {
      const i = rows.findIndex((r) => r.id === id && r.userId === userId);
      if (i < 0) return null;
      const [row] = rows.splice(i, 1);
      return { imageKey: row.imageKey };
    },
    async clear(userId) {
      const imageKeys = [];
      let deleted = 0;
      for (let i = rows.length - 1; i >= 0; i--)
        if (rows[i].userId === userId) {
          if (rows[i].imageKey) imageKeys.push(rows[i].imageKey);
          rows.splice(i, 1);
          deleted++;
        }
      return { deleted, imageKeys };
    },
  };
}

// In-memory stand-in for the private image storage.
function memoryImages() {
  const files = new Map();
  return {
    files,
    async store(userId) {
      const key = `flower-identifications/${userId}/${files.size}.jpg`;
      files.set(key, Buffer.from("img"));
      return key;
    },
    async open(key) {
      const data = files.get(key);
      if (!data) return null;
      const { Readable } = await import("node:stream");
      return { stream: Readable.from([data]), size: data.length, contentType: "image/jpeg" };
    },
    async remove(key) {
      files.delete(key);
    },
  };
}

function call(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body });
      },
    };
    handler({ query: {}, params: {}, ...req }, res, reject);
  });
}

const candidate = { scientificName: "Spiraea thunbergii", commonNames: ["Thunberg's Meadowsweet"], family: "Rosaceae", score: 0.387 };

test("identify saves the result to history and returns historyId", async () => {
  const history = memoryHistory();
  const c = createFlowerController({
    identify: async () => [{ ...candidate }],
    describe: async () => ({ vietnameseName: "Tuyết mai", description: { vi: "Tuyết mai là loài...", en: "" } }),
    history,
    images: memoryImages(),
  });
  const { body } = await call(c.identify, { user: USER, file: {} });
  assert.equal(body.data.historyId, ID);
  assert.equal(body.data.candidates[0].vietnameseName, "Tuyết mai");
  assert.equal(history.rows[0].vietnameseName, "Tuyết mai");
});

test("identify with no result saves nothing, and a history failure does not break it", async () => {
  const history = memoryHistory();
  const empty = createFlowerController({ identify: async () => [], history, images: memoryImages() });
  assert.equal((await call(empty.identify, { user: USER, file: {} })).body.data.historyId, null);
  assert.equal(history.rows.length, 0);

  // The photo stored before the failed insert must be cleaned up.
  const brokenImages = memoryImages();
  const broken = createFlowerController({
    identify: async () => [{ ...candidate }],
    describe: async () => ({ vietnameseName: "", description: { vi: "", en: "" } }),
    history: { create: async () => { throw new Error("db down"); } },
    images: brokenImages,
  });
  const original = console.error;
  console.error = () => {};
  try {
    const { status, body } = await call(broken.identify, { user: USER, file: {} });
    assert.equal(status, 200);
    assert.equal(body.data.historyId, null);
    assert.equal(body.data.candidates.length, 1);
    assert.equal(brokenImages.files.size, 0);
  } finally {
    console.error = original;
  }
});

test("history is scoped to its owner for read and delete", async () => {
  const history = memoryHistory();
  await history.create(USER.id, [candidate]);
  const c = createFlowerController({ history, images: memoryImages() });

  const list = await call(c.listHistory, { user: USER });
  assert.equal(list.body.data.length, 1);
  assert.deepEqual(list.body.pagination, { page: 1, limit: 20, total: 1, total_pages: 1 });
  assert.equal((await call(c.listHistory, { user: OTHER })).body.data.length, 0);

  assert.equal((await call(c.getHistory, { user: USER, params: { id: ID } })).status, 200);
  assert.equal((await call(c.getHistory, { user: OTHER, params: { id: ID } })).status, 404);
  assert.equal((await call(c.deleteHistory, { user: OTHER, params: { id: ID } })).status, 404);
  assert.equal(history.rows.length, 1);
  assert.equal((await call(c.deleteHistory, { user: USER, params: { id: ID } })).status, 200);
  assert.equal(history.rows.length, 0);
});

test("validates id and paging, and clears only the caller's history", async () => {
  const history = memoryHistory();
  await history.create(USER.id, [candidate]);
  await history.create(OTHER.id, [candidate]);
  const c = createFlowerController({ history, images: memoryImages() });
  assert.equal((await call(c.getHistory, { user: USER, params: { id: "abc" } })).status, 400);
  for (const query of [{ page: "0" }, { limit: "51" }, { limit: "x" }])
    assert.equal((await call(c.listHistory, { user: USER, query })).status, 400);
  const cleared = await call(c.clearHistory, { user: USER });
  assert.equal(cleared.body.data.deleted, 1);
  assert.equal(history.rows.length, 1);
  assert.equal(history.rows[0].userId, OTHER.id);
});

test("stores the photo with the entry, streams it only to its owner and deletes it", async () => {
  const history = memoryHistory();
  const images = memoryImages();
  const c = createFlowerController({
    identify: async () => [{ ...candidate }],
    describe: async () => ({ vietnameseName: "", description: { vi: "", en: "" } }),
    history,
    images,
  });
  const { body } = await call(c.identify, { user: USER, file: {} });
  const id = body.data.historyId;
  assert.equal(images.files.size, 1);
  assert.equal(history.rows[0].hasImage, true);

  // Owner gets the bytes with a private cache header.
  const chunks = [];
  const headers = {};
  await new Promise((resolve, reject) => {
    const { Writable } = require_stream();
    const res = Object.assign(
      new Writable({ write(chunk, _e, cb) { chunks.push(chunk); cb(); } }),
      { set(h) { Object.assign(headers, h); }, status() { return this; }, json: reject },
    );
    res.on("finish", resolve);
    c.getHistoryImage({ user: USER, params: { id } }, res, reject);
  });
  assert.equal(Buffer.concat(chunks).toString(), "img");
  assert.equal(headers["Content-Type"], "image/jpeg");
  assert.match(headers["Cache-Control"], /^private/);

  // Another user gets 404, and deleting the entry removes the file.
  assert.equal((await call(c.getHistoryImage, { user: OTHER, params: { id } })).status, 404);
  await call(c.deleteHistory, { user: USER, params: { id } });
  assert.equal(images.files.size, 0);
});

test("clearing history removes every stored photo of the caller", async () => {
  const history = memoryHistory();
  const images = memoryImages();
  const c = createFlowerController({
    identify: async () => [{ ...candidate }],
    describe: async () => ({ vietnameseName: "", description: { vi: "", en: "" } }),
    history,
    images,
  });
  await call(c.identify, { user: USER, file: {} });
  await call(c.identify, { user: USER, file: {} });
  assert.equal(images.files.size, 2);
  const { body } = await call(c.clearHistory, { user: USER });
  assert.equal(body.data.deleted, 2);
  assert.equal(images.files.size, 0);
});
