import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

// Luồng bó hoa tự tạo trên PostgreSQL thật: CART05 -> CART01 -> CHK01 -> CHK02 -> ORD02 -> ORD03.
// Chỉ chạy khi FLOWER_TEST_DATABASE_URL trỏ tới DB dùng một lần flower_test.
test(
  "custom bouquet: cart, quote, order, cancel on isolated PostgreSQL",
  { skip: !process.env.FLOWER_TEST_DATABASE_URL },
  async (t) => {
    const url = new URL(process.env.FLOWER_TEST_DATABASE_URL);
    assert.equal(url.pathname, "/flower_test", "Use the disposable flower_test database only");
    process.env.DATABASE_URL = url.href;
    const { default: pool, initDB } = await import("../src/config/db.js");
    const productIds = [];
    const userIds = [];
    t.after(async () => {
      if (userIds.length) {
        await pool.query("DELETE FROM orders WHERE user_id = ANY($1::uuid[])", [userIds]);
        await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
      }
      if (productIds.length) await pool.query("DELETE FROM products WHERE id = ANY($1::uuid[])", [productIds]);
      await pool.end();
    });
    await initDB();
    await initDB(); // schema idempotent

    const { default: catalog } = await import("../src/modules/catalog/catalog.repository.js");
    async function product(name, variants, { stem = true, active = true } = {}) {
      const { id } = await catalog.create({
        name, category: "Hoa lẻ theo cành", variants, is_active: active,
        price: variants[0].price, stock: variants.reduce((s, v) => s + v.stock_quantity, 0),
      });
      await pool.query("UPDATE products SET sold_by_stem = $1 WHERE id = $2", [stem, id]);
      productIds.push(id);
      return id;
    }
    const rose = await product("test hồng cành", [
      { id: "do", label: "1 cành", color: "Đỏ", price: 20000, stock_quantity: 30, stem_image: "/uploads/r.png" },
    ]);
    const baby = await product("test baby cành", [
      { id: "trang", label: "1 cành", color: "Trắng", price: 10000, stock_quantity: 20 },
    ]);
    const stopped = await product("test cúc ngừng bán", [
      { id: "vang", label: "1 cành", color: "Vàng", price: 9000, stock_quantity: 50 },
    ], { active: false });
    const ready = await product("test bó hồng làm sẵn", [
      { id: "hong-10", label: "10 bông", color: "Đỏ", price: 450000, stock_quantity: 5 },
    ], { stem: false });

    const { default: cartRoutes } = await import("../src/routes/cart.routes.js");
    const { default: checkoutRoutes } = await import("../src/routes/checkout.routes.js");
    const { default: orderRoutes } = await import("../src/routes/order.routes.js");
    const { errorHandler } = await import("../src/common/middlewares/errorHandler.js");
    const { generateAccessToken } = await import("../src/utils/jwt.js");
    const app = express();
    app.use(express.json());
    app.use("/cart", cartRoutes);
    app.use("/checkout", checkoutRoutes);
    app.use("/orders", orderRoutes);
    app.use(errorHandler);
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(() => server.close());
    const base = `http://127.0.0.1:${server.address().port}`;

    const { rows } = await pool.query(
      "INSERT INTO users (name,email,password,role) VALUES ('test',$1,'test','customer') RETURNING id",
      [`${crypto.randomUUID()}@bouquet.test`],
    );
    userIds.push(rows[0].id);
    const auth = { Authorization: `Bearer ${generateAccessToken({ id: rows[0].id })}` };
    const call = async (method, path, body, headers = {}) => {
      const response = await fetch(base + path, {
        method,
        headers: { ...auth, "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    };
    const addBouquet = (items, extra = {}) => call("POST", "/cart/bouquets", { items, ...extra });
    const stockOf = async (id) => (await pool.query("SELECT stock FROM products WHERE id = $1", [id])).rows[0].stock;

    assert.equal((await fetch(base + "/cart/bouquets", { method: "POST" })).status, 401);

    // Kịch bản chính: 3 hồng đỏ 20.000 + 2 baby 10.000 = 80.000, giá client gửi bị bỏ qua
    const main = [
      { product_id: rose, variant_id: "do", stems: 3, price: 1, unit_price: 1 },
      { product_id: baby, variant_id: "trang", stems: 2 },
    ];
    let res = await addBouquet(main, { unit_price: 1, price: 1, line_total: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    let line = res.body.data.items.find((item) => item.item_type === "custom_bouquet");
    assert.equal(line.unit_price, 80000);
    assert.equal(line.line_total, 80000);
    assert.equal(line.quantity, 1);
    assert.equal(line.is_available, true);
    assert.deepEqual(line.components.map((c) => [c.product_name, c.color, c.stems, c.unit_price]).sort(), [
      ["test baby cành", "Trắng", 2, 10000],
      ["test hồng cành", "Đỏ", 3, 20000],
    ]);

    // Cùng thành phần (khác thứ tự) => cộng số lượng; khác thành phần => dòng mới
    res = await addBouquet([...main].reverse());
    assert.equal(res.body.data.items.filter((item) => item.item_type === "custom_bouquet").length, 1);
    assert.equal(res.body.data.items[0].quantity, 2);
    res = await addBouquet([{ product_id: rose, variant_id: "do", stems: 5 }]);
    assert.equal(res.body.data.items.filter((item) => item.item_type === "custom_bouquet").length, 2);

    // Tải lại giỏ: thành phần vẫn còn
    res = await call("GET", "/cart");
    assert.equal(res.status, 200);
    line = res.body.data.items.find((item) => item.item_type === "custom_bouquet" && item.components.length === 2);
    assert.equal(line.quantity, 2);
    assert.equal(res.body.data.subtotal, 2 * 80000 + 5 * 20000);

    // Kịch bản lỗi
    const errors = [
      [[], 400],
      [[{ product_id: "abc", variant_id: "do", stems: 1 }], 400],
      [[{ product_id: crypto.randomUUID(), variant_id: "do", stems: 1 }], 404],
      [[{ product_id: rose, variant_id: "khong-co", stems: 1 }], 404],
      [[{ product_id: stopped, variant_id: "vang", stems: 1 }], 409],
      [[{ product_id: ready, variant_id: "hong-10", stems: 1 }], 400],
      [[{ product_id: rose, variant_id: "do", stems: -1 }], 400],
      [[{ product_id: rose, variant_id: "do", stems: 0 }], 400],
      [[{ product_id: rose, variant_id: "do", stems: 1.5 }], 400],
      [[{ product_id: rose, variant_id: "do", stems: "2" }], 400],
      [[{ product_id: baby, variant_id: "trang", stems: 21 }], 409],
    ];
    for (const [items, status] of errors) {
      res = await addBouquet(items);
      assert.equal(res.status, status, `${JSON.stringify(items)} -> ${JSON.stringify(res.body)}`);
    }
    // Bó hiện có 2 bó × 2 baby = 4; thêm 9 bó nữa cần 22 cành > 20
    assert.equal((await addBouquet(main, { quantity: 9 })).status, 409);
    assert.equal((await addBouquet(main, { quantity: 1.5 })).status, 400);

    // Giấy gói: phụ phí cộng vào đơn giá, khác kiểu gói là dòng riêng
    res = await addBouquet(main, { wrap: "silk", height: "tall" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const silk = res.body.data.items.find((item) => item.style?.wrap === "silk");
    assert.equal(silk.unit_price, 110000, "80.000 tiền hoa + 30.000 giấy lụa");
    assert.equal(silk.style.wrap_price, 30000);
    assert.equal(silk.style.height_name, "Cao, vươn thẳng");
    assert.equal(
      res.body.data.items.filter((item) => item.item_type === "custom_bouquet").length,
      3,
      "kraft, hồng 5 cành và lụa là ba dòng",
    );
    res = await addBouquet(main, { wrap: "silk", height: "tall" });
    assert.equal(res.body.data.items.find((item) => item.style?.wrap === "silk").quantity, 2);
    // Mỗi loại hoa một chiều dài riêng: dòng giỏ riêng, giá không đổi
    const mixed = [
      { ...main[0], stem_length: 65 },
      { ...main[1], stem_length: 40 },
    ];
    res = await addBouquet(mixed);
    const custom = res.body.data.items.find((item) =>
      item.components?.some((c) => c.stem_length === 65),
    );
    assert.equal(custom.unit_price, 80000, "chiều dài cành không đổi giá");
    assert.deepEqual(
      custom.components.map((c) => c.stem_length).sort(),
      [40, 65],
    );
    assert.equal((await addBouquet(mixed)).body.data.items.find((item) =>
      item.components?.some((c) => c.stem_length === 65)).quantity, 2);
    for (const items of [[{ ...main[0], stem_length: 52 }], [{ ...main[0], stem_length: 100 }]]) {
      assert.equal((await addBouquet(items)).status, 400, JSON.stringify(items));
    }
    for (const style of [{ wrap: "giay-vang" }, { height: "sieu-cao" }]) {
      assert.equal((await addBouquet(main, style)).status, 400, JSON.stringify(style));
    }

    // CART02 với bó làm sẵn vẫn như cũ
    res = await call("POST", "/cart/items", { product_id: ready, variant_id: "hong-10", quantity: 1 });
    assert.equal(res.status, 200);
    const readyLine = res.body.data.items.find((item) => item.product_id === ready);
    assert.equal(readyLine.item_type, "product");
    assert.equal(readyLine.unit_price, 450000);

    // Báo giá + tạo đơn chỉ với dòng bó 3 hồng + 2 baby (2 bó)
    const roseBefore = await stockOf(rose);
    const babyBefore = await stockOf(baby);
    res = await call("POST", "/checkout/quote", {
      cart_item_ids: [line.id], delivery_method: "pickup", payment_method: "cod",
      recipient: { name: "Test", phone: "0900000000" },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.subtotal, 160000);
    res = await call("POST", "/orders", { quote_id: res.body.data.quote_id }, { "Idempotency-Key": crypto.randomUUID() });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const orderId = res.body.data.id;
    assert.deepEqual(res.body.data.removed_cart_item_ids, [line.id]);
    assert.equal(await stockOf(rose), roseBefore - 6);
    assert.equal(await stockOf(baby), babyBefore - 4);
    const roseVariant = (await pool.query("SELECT variants FROM products WHERE id = $1", [rose])).rows[0].variants[0];
    assert.equal(roseVariant.stock_quantity, roseBefore - 6);

    res = await call("GET", `/orders/${orderId}`);
    assert.equal(res.status, 200);
    const ordered = res.body.data.items[0];
    assert.equal(ordered.item_type, "custom_bouquet");
    assert.equal(ordered.product_id, null);
    assert.equal(ordered.unit_price, 80000);
    assert.equal(ordered.components.length, 2);
    assert.equal(ordered.style.wrap, "kraft", "đơn lưu lại kiểu gói lúc đặt");
    assert.equal(ordered.style.wrap_price, 0);
    assert.ok(
      ordered.components.every((c) => c.stem_length === 50),
      "mặc định 50 cm cho mọi loại hoa",
    );
    assert.ok(ordered.components.every((c) => c.product_name && c.stems && c.unit_price));
    res = await call("GET", "/orders");
    assert.equal(res.body.data[0].items[0].item_type, "custom_bouquet");

    // Hủy đơn hoàn lại từng loại cành
    res = await call("POST", `/orders/${orderId}/cancel`, { reason: "test" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(await stockOf(rose), roseBefore);
    assert.equal(await stockOf(baby), babyBefore);

    // Hoa ngừng bán sau khi đã vào giỏ: dòng bó hiển thị không khả dụng và không báo giá được
    res = await call("GET", "/cart");
    const roseOnly = res.body.data.items.find((item) => item.item_type === "custom_bouquet");
    await pool.query("UPDATE products SET active = FALSE WHERE id = $1", [rose]);
    res = await call("GET", "/cart");
    assert.equal(res.body.data.items.find((item) => item.id === roseOnly.id).is_available, false);
    res = await call("POST", "/checkout/quote", { cart_item_ids: [roseOnly.id], delivery_method: "pickup", payment_method: "cod" });
    assert.equal(res.status, 409);
  },
);
