import { BadRequestError } from "../../common/errors/AppError.js";

export function paymentAmount(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    String(value).trim() === ""
  ) {
    throw new BadRequestError(
      "Số tiền phải là số dương, tối đa hai chữ số thập phân",
    );
  }
  const amount = Number(value);
  const cents = amount * 100;
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 9999999999999.99 ||
    Math.abs(cents - Math.round(cents)) > 0.001
  ) {
    throw new BadRequestError(
      "Số tiền phải là số dương, tối đa hai chữ số thập phân",
    );
  }
  return Math.round(cents) / 100;
}

export function transactionReference(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 100) {
    throw new BadRequestError("Mã giao dịch phải dài từ 1 đến 100 ký tự");
  }
  return value.trim();
}

export function paymentPurpose(value) {
  if (!["deposit", "full"].includes(value))
    throw new BadRequestError("Mục đích thanh toán không hợp lệ");
  return value;
}

export function orderAmounts(order) {
  return Object.fromEntries(
    Object.entries(order).map(([key, value]) => [
      key,
      [
        "total_amount",
        "deposit_amount",
        "paid_amount",
        "refunded_amount",
        "held_amount",
        "remaining_amount",
      ].includes(key)
        ? Number(value)
        : value,
    ]),
  );
}
