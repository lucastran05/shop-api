import { converseAboutFlowers } from './flower-conversation.js';
import { adviseFlowers, isFlowerQuestion } from './flower-advisor.js';
import pool from '../config/db.js';
import storefrontRepository from '../modules/storefront/storefront.repository.js';
import orderRepository from '../modules/storefront/order.repository.js';
import { voucherRepository } from '../modules/storefront/voucher.repository.js';
import { planQuestion, validateMessage } from './chatbot-llm.js';

const money = (value) => Number(value).toLocaleString('vi-VN') + ' đ';
const unknown = 'Mình chưa có dữ liệu hệ thống đủ để trả lời câu hỏi này. Bạn hãy nói rõ tên sản phẩm, mã đơn hoặc chọn “Chat với shop” để nhân viên xác nhận.';

// Model output is a retrieval plan, never a source of business facts.
// Only server-owned templates and database values may reach the answer.
export async function answerFromPlan(plan, userId, db = pool) {
  if (plan.intent === 'order') {
    if (!userId) return { answer: 'Bạn cần đăng nhập bằng tài khoản đã đặt hàng để tra cứu đơn.', action: 'login', sources: [] };
    if (!plan.orderCode) return { answer: 'Vui lòng nhập mã đơn hàng cần tra cứu (xem trong Đơn mua).', action: 'order', sources: [] };
    const { rows } = await db.query('SELECT id FROM orders WHERE user_id=$1 AND UPPER(code)=UPPER($2) LIMIT 1', [userId, plan.orderCode]);
    if (!rows.length) return { answer: 'Không tìm thấy đơn hàng này trong tài khoản của bạn. Vui lòng kiểm tra lại mã đơn.', action: 'order', sources: [] };
    const order = await orderRepository.getUserOrderDetail(userId, rows[0].id, db);
    return { answer: [`Đơn ${order.code}: ${order.status_label}`, `Tổng tiền: ${money(order.total_amount)}`,
      `Phí giao hàng: ${money(order.shipping_fee)}`, `Thanh toán: ${order.payment_status}`,
      ...order.items.map((item) => `• ${item.product_name} × ${item.quantity}`),
      ...(order.shipment?.tracking_number ? [`Mã vận đơn: ${order.shipment.tracking_number}`] : []),
    ].join('\n'), sources: [{ type: 'order', id: order.id, label: order.code }] };
  }
  if (plan.intent === 'products') {
    if (!plan.search.trim()) return { answer: 'Bạn đang tìm sản phẩm nào? Hãy cho mình tên hoặc loại sản phẩm.', sources: [] };
    const term = plan.search.trim().replace(/[\\%_]/g, '\\$&');
    const { rows } = await db.query(`SELECT id,name,price,stock FROM products WHERE active=TRUE
      AND (name ILIKE $1 OR category ILIKE $1) ORDER BY name LIMIT 8`, [`%${term}%`]);
    return { answer: rows.length ? 'Các sản phẩm phù hợp trong danh mục hiện tại:\n' + rows.map((p) =>
      `• ${p.name}: ${money(p.price)}; tồn kho ghi nhận: ${p.stock}. Giá phân loại cụ thể xem tại trang sản phẩm.`).join('\n') :
      'Mình chưa tìm thấy sản phẩm khớp trong danh mục hiện tại. Bạn thử tên ngắn hơn hoặc liên hệ shop nhé.',
    sources: rows.map((p) => ({ type: 'product', id: p.id, label: p.name })) };
  }
  if (plan.intent === 'promotions') {
    const vouchers = await voucherRepository.listAvailable({ userId }, db);
    return { answer: vouchers.length ? 'Ưu đãi còn hiệu lực dành cho bạn:\n' + vouchers.map((v) => [
      `${v.code} — ${v.name}: ${v.discount_type === 'free_shipping' ? 'miễn phí vận chuyển' : v.discount_type === 'percentage' ? `giảm ${v.discount_value}%` : `giảm ${money(v.discount_value)}`}`,
      `Đơn tối thiểu ${money(v.min_order_amount)}`,
      ...(v.max_discount_amount != null ? [`Giảm tối đa ${money(v.max_discount_amount)}`] : []),
      ...(v.expires_at ? [`Hết hạn ${new Date(v.expires_at).toISOString()}`] : []),
    ].join('; ')).join('\n') + '\nĐiều kiện và lượt sử dụng được kiểm tra lại khi thanh toán.' : 'Hiện chưa có ưu đãi còn hiệu lực dành cho bạn.',
    sources: vouchers.map((v) => ({ type: 'voucher', id: v.id, label: v.code })) };
  }
  if (plan.intent === 'contact') {
    const shop = await storefrontRepository.getShop(db);
    const contact = shop ? [shop.name, shop.phone, shop.email, shop.address].filter(Boolean) : [];
    return { answer: contact.length ? contact.join('\n') : 'Shop chưa cập nhật thông tin liên hệ. Bạn có thể dùng Chat với shop.', sources: shop ? [{ type: 'shop', id: shop.id, label: shop.name }] : [] };
  }
  if (plan.intent === 'shipping') return { answer: 'Bạn muốn giao tới địa chỉ nào? Nhập số nhà/đường, phường/xã và tỉnh/thành. Mình sẽ hỏi thêm khoảng cách và khối lượng; kết quả là ước tính minh họa, không phải phí checkout.', action: 'shipping', sources: [] };
  if (plan.intent === 'help') return { answer: 'Mình có thể tìm sản phẩm trong shop, tra cứu đơn của bạn, xem voucher và hỗ trợ ước tính vận chuyển. Để mua hàng, chọn sản phẩm, thêm vào giỏ và kiểm tra thông tin tại bước thanh toán.', sources: [{ type: 'guide', label: 'Luồng mua hàng của hệ thống' }] };
  return { answer: unknown, sources: [] };
}

export async function chatAnswer(body, userId) {
  const input = validateMessage(body);
  if (isFlowerQuestion(input)) {
    try { return { ...await adviseFlowers(input), checkedAt: new Date().toISOString() }; }
    catch { return { answer: 'Mình chưa có giá và số lượng đã xác nhận cho mẫu này.', sources: [], mode: 'unavailable' }; }
  }
  if (!process.env.GEMINI_API_KEY?.trim()) return {
    answer: 'Mình chưa có câu trả lời đủ chắc chắn cho câu hỏi này.',
    sources: [], mode: 'unavailable',
  };
  let plan;
  try { plan = isFlowerQuestion(input) ? { intent: 'flowers', search: '', orderCode: '' } : await planQuestion(input); } catch {
    // Do not expose provider response, request body, API key or internal errors.
    return converseAboutFlowers(input, { general: true });
  }
  if (['general', 'help', 'unknown'].includes(plan.intent)) {
    return { ...await converseAboutFlowers(input, { general: true }), checkedAt: new Date().toISOString() };
  }
  if (plan.intent === 'flowers') {
    try { return { ...await adviseFlowers(input), checkedAt: new Date().toISOString() }; }
    catch { return { answer: 'Mình chưa có giá và số lượng đã xác nhận cho mẫu này.', sources: [], mode: 'unavailable' }; }
  }
  // Never allow an invented order code, even if the model violates its instructions.
  const userText = [input.message, ...input.history.filter((h) => h.role === 'user').map((h) => h.text)].join('\n').toUpperCase();
  if (plan.orderCode && !userText.includes(plan.orderCode.toUpperCase())) plan.orderCode = '';
  return { ...await answerFromPlan(plan, userId), mode: 'grounded', checkedAt: new Date().toISOString() };
}
