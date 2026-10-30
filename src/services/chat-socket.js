import { WebSocket, WebSocketServer } from "ws";
import { verifyAccessToken } from "../utils/jwt.js";
import identityRepository from "../modules/identity/identity.repository.js";
import communicationRepository from "../modules/communication/communication.repository.js";
import CommunicationPolicy from "../modules/communication/communication.policy.js";
import { chatEvents } from "../modules/communication/chat-events.js";

export function attachChatSocket(
  server,
  {
    identity = identityRepository,
    repository = communicationRepository,
    events = chatEvents,
    allowedOrigins = new Set(
      String(process.env.CLIENT_URL || "http://localhost:5173")
        .split(",")
        .map((origin) => origin.trim()),
    ),
  } = {},
) {
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024,
    perMessageDeflate: false,
  });
  function send(socket, frame) {
    if (socket.bufferedAmount > 1024 * 1024) {
      socket.terminate();
      return;
    }
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(frame));
  }
  const broadcast = ({ message, customer, ids }) => {
    for (const socket of sockets.clients) {
      if (
        !socket.user ||
        !(
          CommunicationPolicy.isStaff(socket.user) ||
          socket.user.id === customer?.id
        )
      )
        continue;
      identity
        .findById(socket.user.id)
        .then((actor) => {
          if (
            !actor ||
            actor.active === false ||
            actor.role !== socket.user.role
          )
            socket.close(4403, "Account unavailable");
          else send(socket, ids ? { type: "removed", ids, customer } : { type: "message", message, customer });
        })
        .catch(() => socket.close(1011, "Unable to authorize message"));
    }
  };
  events.on("message", broadcast);
  events.on("removed", broadcast);
  const upgrade = (request, socket, head) => {
    if (
      request.url !== "/api/v1/chat/socket" ||
      (request.headers.origin && !allowedOrigins.has(request.headers.origin))
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    sockets.handleUpgrade(request, socket, head, (ws) =>
      sockets.emit("connection", ws),
    );
  };
  server.on("upgrade", upgrade);
  sockets.on("connection", (socket) => {
    socket.alive = true;
    let queue = Promise.resolve(),
      queued = 0;
    let expiresAt;
    let authTimer = setTimeout(
      () => socket.close(4401, "Authentication required"),
      5000,
    );
    socket.on("pong", () => {
      socket.alive = true;
    });
    socket.on("error", () => socket.terminate());
    socket.on("close", () => clearTimeout(authTimer));
    socket.on("message", (raw, binary) => {
      if (queued >= 16) return socket.close(1013, "Too many pending messages");
      queued++;
      queue = queue
        .then(() => handleMessage(raw, binary))
        .finally(() => {
          queued--;
        });
    });
    async function handleMessage(raw, binary) {
      if (socket.readyState !== WebSocket.OPEN) return;
      let request;
      try {
        if (binary)
          throw Object.assign(new Error("Invalid frame"), { statusCode: 400 });
        request = JSON.parse(raw.toString());
        if (!request || typeof request !== "object" || Array.isArray(request))
          throw Object.assign(new Error("Invalid frame"), { statusCode: 400 });
        if (!socket.user) {
          if (request.type !== "auth" || typeof request.token !== "string")
            return socket.close(4401, "Authentication required");
          let decoded;
          try {
            decoded = verifyAccessToken(request.token);
          } catch {
            return socket.close(4401, "Invalid or expired token");
          }
          const user = await identity.findById(decoded.id);
          if (
            !user ||
            user.active === false ||
            !["admin", "manager", "customer"].includes(user.role)
          )
            return socket.close(4403, "Account unavailable");
          expiresAt = Number(decoded.exp) * 1000;
          if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
            return socket.close(4401, "Expired token");
          socket.user = user;
          clearTimeout(authTimer);
          authTimer = setTimeout(
            () => socket.close(4401, "Expired token"),
            Math.min(expiresAt - Date.now(), 2147483647),
          );
          return send(socket, { type: "ready" });
        }
        if (Date.now() >= expiresAt) return socket.close(4401, "Expired token");
        if (
          typeof request.requestId !== "string" ||
          !/^[A-Za-z0-9-]{1,100}$/.test(request.requestId)
        )
          throw Object.assign(new Error("Invalid request ID"), {
            statusCode: 400,
          });
        const actor = await identity.findById(socket.user.id);
        if (!actor || actor.active === false || actor.role !== socket.user.role)
          return socket.close(4403, "Account unavailable");
        let result;
        if (request.type === "read" && !CommunicationPolicy.isStaff(actor)) {
          result = await repository.markConversationAsRead(
            actor.id,
            actor.email,
          );
        } else if (request.type === "send") {
          if (
            typeof request.content !== "string" ||
            !request.content.trim() ||
            request.content.length > 2000
          )
            throw Object.assign(
              new Error("Tin nhắn phải có từ 1 đến 2000 ký tự"),
              { statusCode: 400 },
            );
          let target = actor.id;
          if (CommunicationPolicy.isStaff(actor)) {
            const key = request.email || request.conversationId;
            if (typeof key !== "string" || !key.trim() || key.length > 255)
              throw Object.assign(new Error("Hội thoại không hợp lệ"), {
                statusCode: 400,
              });
            const context = await repository.getConversationContext(key);
            if (!context.user)
              throw Object.assign(new Error("Không tìm thấy khách hàng"), {
                statusCode: 404,
              });
            const customer = await identity.findById(context.user.id);
            if (customer?.role !== "customer" || customer.active === false)
              throw Object.assign(new Error("Không tìm thấy khách hàng"), {
                statusCode: 404,
              });
            target = customer.id;
          } else if (
            (request.conversationId && request.conversationId !== actor.id) ||
            request.email
          ) {
            throw Object.assign(
              new Error("Bạn không có quyền gửi vào hội thoại này"),
              { statusCode: 403 },
            );
          }
          result = await repository.sendConversationMessage(target, actor, {
            content: request.content,
            client_message_id: request.requestId,
            sender_role: CommunicationPolicy.isStaff(actor)
              ? "shop"
              : "customer",
          });
        } else
          throw Object.assign(new Error("Invalid event"), { statusCode: 400 });
        send(socket, {
          type: "ack",
          requestId: request.requestId,
          data: result,
        });
      } catch (error) {
        send(socket, {
          type: "error",
          requestId: request?.requestId,
          status: error.statusCode || 500,
          message: error.statusCode
            ? error.message
            : "Không thể xử lý tin nhắn. Vui lòng thử lại.",
        });
      }
    }
  });
  const heartbeat = setInterval(() => {
    for (const socket of sockets.clients) {
      if (!socket.alive) {
        socket.terminate();
        continue;
      }
      socket.alive = false;
      socket.ping();
    }
  }, 30000);
  heartbeat.unref();
  const close = () => {
    clearInterval(heartbeat);
    events.off("message", broadcast);
    events.off("removed", broadcast);
    server.off("upgrade", upgrade);
    for (const socket of sockets.clients) socket.terminate();
    sockets.close();
  };
  server.once("close", close);
  return close;
}
