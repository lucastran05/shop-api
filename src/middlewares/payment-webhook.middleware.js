import { createHmac, timingSafeEqual } from "node:crypto";
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
} from "../common/errors/AppError.js";

// This is the app's gateway-to-server contract, not a native MoMo/VNPay signature format.
export function verifyPaymentWebhook(req, res, next) {
  try {
    const provider =
      req.params.provider ||
      process.env.PAYMENT_WEBHOOK_DEFAULT_PROVIDER ||
      "vietqr";
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(provider))
      throw new BadRequestError("Invalid payment provider");
    let secrets;
    try {
      secrets = JSON.parse(process.env.PAYMENT_WEBHOOK_SECRETS || "{}");
    } catch {
      throw new AppError("Payment webhook is not configured", 503);
    }
    const secret = Object.hasOwn(secrets || {}, provider)
      ? secrets[provider]
      : null;
    if (typeof secret !== "string" || secret.length < 32)
      throw new AppError("Payment provider is not configured", 503);
    const timestamp = req.get("X-Webhook-Timestamp") || "";
    const signature = (req.get("X-Signature") || "").replace(/^sha256=/, "");
    if (
      !/^\d{10}$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      !/^[a-f0-9]{64}$/i.test(signature) ||
      !Buffer.isBuffer(req.rawBody)
    ) {
      throw new UnauthorizedError("Invalid webhook signature or timestamp");
    }
    const expected = createHmac("sha256", secret)
      .update(timestamp + ".")
      .update(req.rawBody)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
      throw new UnauthorizedError("Invalid webhook signature");
    req.paymentProvider = provider;
    next();
  } catch (error) {
    next(error);
  }
}
