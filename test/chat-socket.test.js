import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { EventEmitter, once } from "node:events";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { attachChatSocket } from "../src/services/chat-socket.js";
import { generateAccessToken, generateRefreshToken } from "../src/utils/jwt.js";

async function setup(t) {
  const users = ["admin", "manager", "customer", "customer", "customer"].map(
    (role, i) => ({
      id: randomUUID(),
      email: `socket-${i}@example.test`,
      name: `Người thử ${i}`,
      role,
      active: i !== 4,
    }),
  );
  const events = new EventEmitter(),
    saved = [],
    connections = [];
  const repository = {
    async getConversationContext(key) {
      return {
        user: users.find((user) => user.id === key || user.email === key),
      };
    },
    async sendConversationMessage(id, sender, data) {
      const customer = users.find((user) => user.id === id);
      const result = {
        customer,
        message: {
          id: randomUUID(),
          content: data.content.trim(),
          sender_role: data.sender_role,
          created_at: new Date().toISOString(),
        },
      };
      saved.push(result);
      events.emit("message", result);
      return result;
    },
    async markConversationAsRead(id) {
      return {
        updatedCount: saved.filter((row) => row.customer.id === id).length,
      };
    },
  };
  const server = createServer();
  const close = attachChatSocket(server, {
    identity: {
      async findById(id) {
        return users.find((user) => user.id === id);
      },
    },
    repository,
    events,
    allowedOrigins: new Set(["http://localhost:8080"]),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `ws://127.0.0.1:${server.address().port}/api/v1/chat/socket`;
  t.after(async () => {
    for (const ws of connections) ws.terminate();
    close();
    await new Promise((resolve) => server.close(resolve));
  });
  async function connect(token, origin = "http://localhost:8080") {
    const ws = new WebSocket(url, { origin });
    connections.push(ws);
    ws.frames = [];
    ws.on("message", (raw) => ws.frames.push(JSON.parse(raw.toString())));
    await once(ws, "open");
    if (token) ws.send(JSON.stringify({ type: "auth", token }));
    return ws;
  }
  async function frame(ws, predicate) {
    for (let i = 0; i < 200; i++) {
      const result = ws.frames.find(predicate);
      if (result) return result;
      await delay(5);
    }
    assert.fail("Expected socket frame was not received");
  }
  async function authenticated(index) {
    const ws = await connect(generateAccessToken({ id: users[index].id }));
    await frame(ws, (row) => row.type === "ready");
    return ws;
  }
  async function request(ws, type, payload = {}) {
    const requestId = randomUUID();
    ws.send(JSON.stringify({ type, requestId, ...payload }));
    return frame(ws, (row) => row.requestId === requestId);
  }
  return { users, saved, events, connect, authenticated, frame, request, url };
}

test("socket requires a valid access token and rejects disabled accounts", async (t) => {
  const s = await setup(t);
  for (const token of [
    "invalid-token",
    generateRefreshToken({ id: s.users[2].id }),
    generateAccessToken({ id: s.users[4].id }),
  ]) {
    const ws = await s.connect();
    const closed = once(ws, "close");
    ws.send(JSON.stringify({ type: "auth", token }));
    assert.ok([4401, 4403].includes((await closed)[0]));
  }
  const ws = await s.connect();
  const closed = once(ws, "close");
  ws.send(JSON.stringify({ type: "send", content: "Unauthenticated" }));
  assert.equal((await closed)[0], 4401);
  assert.equal(s.saved.length, 0);
});

test("messages go to their customer and staff; customers cannot impersonate or target another customer", async (t) => {
  const s = await setup(t);
  const admin = await s.authenticated(0),
    manager = await s.authenticated(1);
  const customer = await s.authenticated(2),
    outsider = await s.authenticated(3);
  const reply = await s.request(customer, "send", {
    content: "Xin chào 🌿",
    sender_role: "shop",
  });
  assert.equal(reply.type, "ack");
  assert.equal(reply.data.message.sender_role, "customer");
  for (const ws of [customer, admin, manager])
    await s.frame(
      ws,
      (frame) =>
        frame.type === "message" && frame.message.id === reply.data.message.id,
    );
  const staffReply = await s.request(admin, "send", {
    email: s.users[2].email,
    content: "Chào bạn",
  });
  await s.frame(
    customer,
    (frame) =>
      frame.type === "message" &&
      frame.message.id === staffReply.data.message.id,
  );
  await delay(30);
  assert.equal(
    outsider.frames.filter((frame) => frame.type === "message").length,
    0,
  );
  assert.equal(
    (
      await s.request(customer, "send", {
        conversationId: s.users[3].id,
        content: "Forged",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await s.request(customer, "send", {
        email: s.users[3].email,
        content: "Forged",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await s.request(admin, "send", {
        email: "missing@example.test",
        content: "Unknown",
      })
    ).status,
    404,
  );
  assert.equal(s.saved.length, 2);
  s.events.emit('removed', { customer: s.users[2], ids: [reply.data.message.id, staffReply.data.message.id] });
  for (const ws of [customer, admin, manager]) {
    const removed = await s.frame(ws, frame => frame.type === 'removed');
    assert.deepEqual(removed.ids, [reply.data.message.id, staffReply.data.message.id]);
  }
  assert.equal(outsider.frames.filter(frame => frame.type === 'removed').length, 0);
});

test("invalid content is rejected and send/read requests can be queued together", async (t) => {
  const s = await setup(t),
    ws = await s.authenticated(2);
  for (const content of ["", "   ", 123, "a".repeat(2001)])
    assert.equal((await s.request(ws, "send", { content })).status, 400);
  const [sent, read] = await Promise.all([
    s.request(ws, "send", { content: "Hợp lệ" }),
    s.request(ws, "read"),
  ]);
  assert.equal(sent.type, "ack");
  assert.equal(read.type, "ack");
  assert.equal(s.saved.length, 1);
  s.users[2].active = false;
  const closed = once(ws, "close");
  ws.send(
    JSON.stringify({
      type: "send",
      requestId: randomUUID(),
      content: "Blocked",
    }),
  );
  assert.equal((await closed)[0], 4403);
  assert.equal(s.saved.length, 1);
});

test("socket rejects cross-origin upgrades", async (t) => {
  const s = await setup(t);
  const ws = new WebSocket(s.url, { origin: "https://other.example.test" });
  const status = await new Promise((resolve, reject) => {
    ws.on("unexpected-response", (_, response) => {
      response.resume();
      resolve(response.statusCode);
      ws.terminate();
    });
    ws.on("error", (error) => {
      if (ws.readyState !== WebSocket.CLOSING) reject(error);
    });
  });
  assert.equal(status, 403);
});
