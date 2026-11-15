import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";

test(
  "migration, catalog CRUD/filter, auth and admin endpoint on isolated PostgreSQL",
  { skip: !process.env.FLOWER_TEST_DATABASE_URL },
  async (t) => {
    const url = new URL(process.env.FLOWER_TEST_DATABASE_URL);
    assert.equal(
      url.pathname,
      "/flower_test",
      "Use the disposable flower_test database only",
    );
    process.env.DATABASE_URL = url.href;
    const { default: pool, initDB } = await import("../src/config/db.js");
    const ids = [],
      users = [];
    t.after(async () => {
      if (ids.length)
        await pool.query("DELETE FROM products WHERE id=ANY($1::uuid[])", [
          ids,
        ]);
      if (users.length)
        await pool.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [users]);
      await pool.end();
    });
    const { default: catalog } =
      await import("../src/modules/catalog/catalog.repository.js");
    await initDB();
    const migration = (
      await readFile(new URL("../src/config/db.js", import.meta.url), "utf8")
    ).match(
      /ALTER TABLE products ADD COLUMN IF NOT EXISTS flower_species[^;]+;/,
    )[0];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("CREATE TEMP TABLE products (id INTEGER, name TEXT)");
      await client.query("INSERT INTO products VALUES (1, 'legacy')");
      await client.query(migration);
      await client.query(migration);
      assert.deepEqual((await client.query("SELECT * FROM products")).rows, [
        { id: 1, name: "legacy", flower_species: [] },
      ]);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    async function create(fields) {
      const result = await catalog.create({ name: "flower test", ...fields });
      ids.push(result.id);
      return result.id;
    }
    const publicId = await create({
      flower_species: [
        " Rosa   chinensis ",
        "rosa chinensis",
        "Lilium candidum",
      ],
      stock: 0,
    });
    await create({ flower_species: ["Rosa chinensis"], is_active: false });
    await create({
      flower_species: ["Rosa chinensis"],
      attributes: [{ name: "visibility", value: "private" }],
    });
    await create({
      flower_species: ["Rosa chinensis"],
      attributes: [{ name: "visibility", value: "coming_soon" }],
    });
    await create({ flower_species: ["Rosa chinensis var. spontanea"] });
    const legacyId = await create({});
    await initDB();
    assert.deepEqual(
      (await catalog.findDetailFormatted(legacyId)).flower_species,
      [],
    );
    assert.deepEqual(
      (await catalog.findDetailFormatted(publicId)).flower_species,
      ["Rosa chinensis", "Lilium candidum"],
    );
    const matches = await catalog.findAllCustomer({
      flower_species: "  ROSA   chinensis ",
      limit: 6,
    });
    assert.deepEqual(
      matches.items.map((p) => p.id),
      [publicId],
    );
    assert.equal(matches.items[0].stock_quantity, 0);
    assert.equal(
      (await catalog.findAllCustomer({ flower_species: "Rosa" })).items.length,
      0,
    );
    assert.equal(
      (await catalog.findAllCustomer({ flower_species: "Lilium candidum" }))
        .items[0].id,
      publicId,
    );
    await catalog.update(publicId, { name: "renamed" });
    assert.equal(
      (await catalog.findDetailFormatted(publicId)).flower_species.length,
      2,
    );
    await catalog.update(publicId, { flower_species: [] });
    assert.deepEqual(
      (await catalog.findDetailFormatted(publicId)).flower_species,
      [],
    );
    await assert.rejects(catalog.update(publicId, { flower_species: [""] }), {
      statusCode: 400,
    });
    await assert.rejects(
      catalog.findAllCustomer({ flower_species: ["Rosa"] }),
      { statusCode: 400 },
    );
    assert.ok((await catalog.listFlowerSpecies()).includes("Rosa chinensis"));

    const { default: flowerRoutes } =
      await import("../src/routes/flower.routes.js");
    const { default: adminRoutes } =
      await import("../src/routes/admin.routes.js");
    const { default: productRoutes } =
      await import("../src/routes/product.routes.js");
    const { errorHandler } =
      await import("../src/common/middlewares/errorHandler.js");
    const { generateAccessToken } = await import("../src/utils/jwt.js");
    const app = express();
    app.use(express.json());
    app.use("/flowers", flowerRoutes);
    app.use("/admin", adminRoutes);
    app.use("/products", productRoutes);
    app.use(errorHandler);
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(() => server.close());
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal(
      (await fetch(base + "/flowers/identify", { method: "POST" })).status,
      401,
    );
    async function token(role) {
      const { rows } = await pool.query(
        "INSERT INTO users (name,email,password,role) VALUES ('test',$1,'test',$2) RETURNING id",
        [`${crypto.randomUUID()}@flower.test`, role],
      );
      users.push(rows[0].id);
      return generateAccessToken({ id: rows[0].id });
    }
    const customer = await token("customer"),
      admin = await token("admin");
    assert.equal(
      (
        await fetch(base + "/admin/flower-species", {
          headers: { Authorization: `Bearer ${customer}` },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/admin/flower-species", {
          headers: { Authorization: `Bearer ${admin}` },
        })
      ).status,
      200,
    );
    const patch = async (body) =>
      fetch(base + `/admin/products/${publicId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${admin}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await patch({ flower_species: ["Lilium candidum"] })).status,
      200,
    );
    assert.equal((await patch({ name: "changed" })).status, 200);
    assert.deepEqual(
      (await catalog.findDetailFormatted(publicId)).flower_species,
      ["Lilium candidum"],
    );
    assert.equal((await patch({ flower_species: [] })).status, 200);
    assert.deepEqual(
      (await catalog.findDetailFormatted(publicId)).flower_species,
      [],
    );
    assert.equal((await patch({ flower_species: null })).status, 400);
    const createdResponse = await fetch(base + "/admin/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "HTTP flower",
        flower_species: [" Rosa   chinensis "],
        price: 50000,
      }),
    });
    assert.equal(createdResponse.status, 201);
    const createdBody = await createdResponse.json();
    ids.push(createdBody.data.id);
    assert.deepEqual(createdBody.data.flower_species, ["Rosa chinensis"]);
    const filteredResponse = await fetch(
      base + "/products?flower_species=Rosa%20chinensis&limit=6",
    );
    assert.equal(filteredResponse.status, 200);
    assert.deepEqual(
      (await filteredResponse.json()).data.map((p) => p.id),
      [createdBody.data.id],
    );
    const previousKey = process.env.PLANTNET_API_KEY;
    process.env.PLANTNET_API_KEY = "";
    try {
      const form = new FormData();
      form.append(
        "image",
        new Blob([Buffer.from([255, 216, 255, 224])], { type: "image/jpeg" }),
        "flower.jpg",
      );
      assert.equal(
        (
          await fetch(base + "/flowers/identify", {
            method: "POST",
            headers: { Authorization: `Bearer ${customer}` },
            body: form,
          })
        ).status,
        503,
      );
      for (let i = 0; i < 9; i++)
        assert.equal(
          (
            await fetch(base + "/flowers/identify", {
              method: "POST",
              headers: { Authorization: `Bearer ${customer}` },
            })
          ).status,
          400,
        );
      assert.equal(
        (
          await fetch(base + "/flowers/identify", {
            method: "POST",
            headers: { Authorization: `Bearer ${customer}` },
          })
        ).status,
        429,
      );
      assert.equal(
        (
          await fetch(base + "/flowers/identify", {
            method: "POST",
            headers: { Authorization: `Bearer ${admin}` },
          })
        ).status,
        400,
      );
    } finally {
      if (previousKey === undefined) delete process.env.PLANTNET_API_KEY;
      else process.env.PLANTNET_API_KEY = previousKey;
    }
  },
);
