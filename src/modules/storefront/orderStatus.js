// Quy trình trạng thái đơn hàng: nhãn hiển thị và các bước chuyển hợp lệ.

export const ORDER_STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  processing: 'Đang chuẩn bị hàng',
  packed: 'Đã đóng gói',
  shipping: 'Đang giao hàng',
  delivered: 'Giao thành công',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  returned: 'Hoàn hàng',
  refunded: 'Đã hoàn tiền',
};

// Trạng thái hiện tại -> các trạng thái admin được chuyển tới (kể cả lùi một bước)
const NEXT_STATUSES = {
  pending: [
    { code: 'confirmed', label: 'Xác nhận đơn' },
    { code: 'cancelled', label: 'Hủy đơn' },
  ],
  confirmed: [
    { code: 'pending', label: 'Về chờ xác nhận' },
    { code: 'processing', label: 'Chuẩn bị hàng' },
    { code: 'shipping', label: 'Giao hàng' },
    { code: 'cancelled', label: 'Hủy đơn' },
  ],
  processing: [
    { code: 'confirmed', label: 'Về đã xác nhận' },
    { code: 'packed', label: 'Đóng gói đơn' },
    { code: 'shipping', label: 'Giao hàng' },
    { code: 'cancelled', label: 'Hủy đơn' },
  ],
  packed: [
    { code: 'processing', label: 'Về chuẩn bị hàng' },
    { code: 'shipping', label: 'Giao hàng' },
    { code: 'cancelled', label: 'Hủy đơn' },
  ],
  shipping: [
    { code: 'packed', label: 'Về đã đóng gói' },
    { code: 'delivered', label: 'Giao thành công' },
    { code: 'returned', label: 'Hoàn hàng' },
  ],
  delivered: [
    { code: 'shipping', label: 'Về đang giao hàng' },
    { code: 'completed', label: 'Hoàn thành' },
    { code: 'returned', label: 'Hoàn hàng' },
  ],
  completed: [
    { code: 'delivered', label: 'Về giao thành công' },
    { code: 'returned', label: 'Hoàn hàng' },
  ],
  returned: [],
  cancelled: [],
  refunded: [],
};

export const statusLabel = (order) =>
  order.status_label || ORDER_STATUS_LABELS[order.status] || order.status;

// Đơn đã từng rời kho (kể cả khi admin lùi trạng thái về trước "shipping")
export function hasBeenShipped(order) {
  return Boolean(
    order.shipment?.shipped_at ||
      ['shipping', 'delivered', 'completed'].includes(order.status) ||
      (Array.isArray(order.history) && order.history.some((event) => event.status === 'shipping')),
  );
}

// Đơn đã giao đi thì không được hủy nữa
export const allowedNextStatuses = (order) =>
  (NEXT_STATUSES[order.status] || []).filter((item) => item.code !== 'cancelled' || !hasBeenShipped(order));

export const hasAdminWorkflow = (order) => (NEXT_STATUSES[order.status] || []).length > 0;

export const canCustomerCancel = (order) =>
  ['pending', 'confirmed'].includes(order.status) && !hasBeenShipped(order);
