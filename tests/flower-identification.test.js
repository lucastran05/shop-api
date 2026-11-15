import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  identifyFlower,
  validateFlowerImage,
} from "../src/services/flower-identification.js";
import { normalizeFlowerSpecies } from "../src/modules/catalog/flowerSpecies.js";
import { flowerUpload } from "../src/routes/flower.routes.js";
import { rateLimiter } from "../src/middlewares/rateLimiter.middleware.js";
const file = {
  buffer: Buffer.from([255, 216, 255, 224, 0, 1]),
  mimetype: "image/jpeg",
};
const response = (status, body) => async () => ({
  status,
  ok: status === 200,
  json: async () => body,
});
const species = (name, score) => ({
  score,
  species: { scientificNameWithoutAuthor: name },
});

test("normalizes names, preserves first spelling and rejects invalid values", () => {
  assert.deepEqual(
    normalizeFlowerSpecies([
      "  Rosa   chinensis ",
      "rosa chinensis",
      "Lilium candidum",
    ]),
    ["Rosa chinensis", "Lilium candidum"],
  );
  assert.deepEqual(normalizeFlowerSpecies([]), []);
  for (const value of [
    null,
    "Rose",
    [null],
    [" "],
    ["x".repeat(151)],
    Array(21).fill("Rose"),
  ])
    assert.throws(() => normalizeFlowerSpecies(value));
});
test("validates bytes, MIME, empty and oversized images", () => {
  validateFlowerImage(file);
  validateFlowerImage({
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
    mimetype: "image/png",
  });
  for (const value of [
    null,
    { ...file, buffer: Buffer.alloc(0) },
    { ...file, buffer: Buffer.from("fake") },
    { ...file, mimetype: "image/png" },
    { ...file, buffer: Buffer.alloc(10 * 1024 * 1024 + 1) },
  ])
    assert.throws(() => validateFlowerImage(value));
});
test("sorts, limits and maps provider results without inventing names", async () => {
  let calls = 0;
  const candidates = await identifyFlower(file, {
    apiKey: "test",
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(options.body.get("organs"), "flower");
      assert.equal(options.body.get("images").type, "image/jpeg");
      assert.ok(url.includes("/identify/all?"));
      return response(200, {
        results: [
          species("A", 0.1),
          species("B", 0.9),
          species("C", 0.5),
          species("D", 0.3),
        ],
      })();
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(
    candidates.map((c) => c.scientificName),
    ["B", "C", "D"],
  );
  assert.deepEqual(candidates[0].commonNames, []);
});
test("only confirmed no-result is empty; errors remain errors", async () => {
  const options = { apiKey: "test" };
  assert.deepEqual(
    await identifyFlower(file, {
      ...options,
      fetchImpl: response(404, { message: "Species not found" }),
    }),
    [],
  );
  assert.deepEqual(
    await identifyFlower(file, {
      ...options,
      fetchImpl: response(200, { results: [] }),
    }),
    [],
  );
  for (const [status, body, expected] of [
    [404, {}, 502],
    [429, {}, 503],
    [401, {}, 502],
    [500, {}, 502],
    [200, {}, 502],
    [200, { results: [species("A", 2)] }, 502],
  ]) {
    await assert.rejects(
      identifyFlower(file, { ...options, fetchImpl: response(status, body) }),
      { statusCode: expected },
    );
  }
  await assert.rejects(identifyFlower(file, { apiKey: "" }), {
    statusCode: 503,
  });
  await assert.rejects(
    identifyFlower(file, {
      ...options,
      fetchImpl: async () => {
        throw Error("secret-key");
      },
    }),
    (e) => e.statusCode === 502 && !e.message.includes("secret-key"),
  );
  await assert.rejects(
    identifyFlower(file, {
      ...options,
      signal: AbortSignal.abort(),
      fetchImpl: async () => {
        throw Error();
      },
    }),
    { statusCode: 504 },
  );
});
test("multipart accepts one image, rejects extra, oversized, empty or fake files", async (t) => {
  const app = express();
  app.post("/", flowerUpload, (req, res, next) => {
    try {
      validateFlowerImage(req.file);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.use((err, _req, res, _next) =>
    res.status(err.statusCode || 400).json({ error: err.code || err.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => server.close());
  async function send(buffers, type = "image/jpeg") {
    const form = new FormData();
    for (const buffer of buffers)
      form.append("image", new Blob([buffer], { type }), "test.jpg");
    return fetch(`http://127.0.0.1:${server.address().port}/`, {
      method: "POST",
      body: form,
    });
  }
  assert.equal((await send([file.buffer])).status, 200);
  for (const buffers of [
    [],
    [Buffer.alloc(0)],
    [Buffer.from("fake")],
    [file.buffer, file.buffer],
    [Buffer.alloc(10 * 1024 * 1024 + 1)],
  ])
    assert.notEqual((await send(buffers)).status, 200);
  assert.equal((await send([file.buffer], "image/webp")).status, 415);
});
test("account limiter separates users; default limiter still shares IP", () => {
  const run = (middleware, id, path) => {
    let status = 200;
    middleware(
      { user: { id }, ip: "test-ip", path, baseUrl: "/test" },
      {
        setHeader() {},
        status(code) {
          status = code;
          return this;
        },
        json() {},
      },
      () => {},
    );
    return status;
  };
  const account = rateLimiter({ max: 1, keyGenerator: (req) => req.user.id });
  assert.equal(run(account, "a", "account"), 200);
  assert.equal(run(account, "a", "account"), 429);
  assert.equal(run(account, "b", "account"), 200);
  const ip = rateLimiter({ max: 1 });
  assert.equal(run(ip, "a", "ip"), 200);
  assert.equal(run(ip, "b", "ip"), 429);
});
