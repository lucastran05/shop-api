import { Router } from 'express';
import { optionalAuth, verifyAuth } from '../../middlewares/auth.middleware.js';
import { rateLimiter } from '../../middlewares/rateLimiter.middleware.js';
import service from './service.js';
import repository from './repository.js';
import { COLORS } from './intent.js';
import { THEME_KEYS } from './themes.js';

const router = Router();
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const bad = (res, message) => res.status(400).json({ status: 'error', message });
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const cleanList = (value, allowed, max) => Array.isArray(value) && value.length <= max &&
  value.every((item) => typeof item === 'string' && allowed.includes(item));
const railKeys = ['holiday', 'occasion', 'for_you', 'themes', 'season', 'featured', 'new', 'recent_theme'];

router.get('/rails', optionalAuth, rateLimiter({ max: 120 }), wrap(async (req, res) => {
  res.json({ status: 'success', data: await service.rails(req.user?.id) });
}));

router.post('/interpret', optionalAuth, rateLimiter({ max: 20, windowMs: 60 * 60 * 1000 }), wrap(async (req, res) => {
  const input = req.body?.input;
  if (typeof input !== 'string' || input.trim().length < 2 || input.length > 500) {
    return bad(res, 'Hãy nhập nội dung từ 2 đến 500 ký tự.');
  }
  res.json({ status: 'success', data: await service.world(input.trim(), req.user?.id) });
}));

router.post('/refine', optionalAuth, rateLimiter({ max: 60, windowMs: 60 * 60 * 1000 }), wrap(async (req, res) => {
  const { input, refinement } = req.body || {};
  if (typeof input !== 'string' || input.trim().length < 2 || input.length > 500 ||
      !['gentle', 'bright', 'elegant', 'pastel'].includes(refinement)) {
    return bad(res, 'Điều chỉnh gợi ý không hợp lệ.');
  }
  res.json({ status: 'success', data: await service.refine(input.trim(), refinement, req.user?.id) });
}));

router.get('/preferences', verifyAuth, wrap(async (req, res) => {
  res.json({ status: 'success', data: await repository.preference(req.user.id) });
}));
router.put('/preferences', verifyAuth, wrap(async (req, res) => {
  const { consent, favorite_colors, favorite_themes } = req.body || {};
  if (typeof consent !== 'boolean' || !cleanList(favorite_colors, COLORS, 4) ||
      !cleanList(favorite_themes, THEME_KEYS, 4)) return bad(res, 'Tùy chọn cá nhân hóa không hợp lệ.');
  const data = await repository.updatePreference(req.user.id, { consent, favorite_colors, favorite_themes });
  res.json({ status: 'success', data });
}));

router.get('/occasions', verifyAuth, wrap(async (req, res) => {
  res.json({ status: 'success', data: await repository.occasions(req.user.id) });
}));
function occasionValue(body) {
  if (!body || typeof body.title !== 'string' || body.title.trim().length < 2 || body.title.length > 80) return null;
  if (!['birthday', 'anniversary', 'graduation', 'gratitude', 'special'].includes(body.kind)) return null;
  const { month, day, reminder_days, enabled } = body;
  if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(reminder_days) ||
      reminder_days < 0 || reminder_days > 30 || typeof enabled !== 'boolean') return null;
  const date = new Date(Date.UTC(2024, month - 1, day));
  if (date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return { title: body.title.trim(), kind: body.kind, month, day, reminder_days, enabled };
}
router.post('/occasions', verifyAuth, wrap(async (req, res) => {
  const value = occasionValue(req.body);
  if (!value) return bad(res, 'Ngày hoặc thông tin dịp lễ không hợp lệ.');
  const existing = await repository.occasions(req.user.id);
  if (existing.length >= 30) return bad(res, 'Bạn chỉ có thể lưu tối đa 30 dịp.');
  res.status(201).json({ status: 'success', data: await repository.createOccasion(req.user.id, value) });
}));
router.put('/occasions/:id', verifyAuth, wrap(async (req, res) => {
  if (!uuid(req.params.id)) return bad(res, 'ID dịp không hợp lệ.');
  const value = occasionValue(req.body);
  if (!value) return bad(res, 'Ngày hoặc thông tin dịp lễ không hợp lệ.');
  const data = await repository.updateOccasion(req.user.id, req.params.id, value);
  res.status(data ? 200 : 404).json({ status: data ? 'success' : 'error', data });
}));
router.delete('/occasions/:id', verifyAuth, wrap(async (req, res) => {
  if (!uuid(req.params.id)) return bad(res, 'ID dịp không hợp lệ.');
  const deleted = await repository.deleteOccasion(req.user.id, req.params.id);
  res.status(deleted ? 200 : 404).json({ status: deleted ? 'success' : 'error', data: { deleted } });
}));

router.post('/feedback', verifyAuth, rateLimiter({ max: 60, windowMs: 60 * 60 * 1000 }), wrap(async (req, res) => {
  const preference = await repository.preference(req.user.id);
  if (!preference.consent) return res.status(403).json({ status: 'error', message: 'Cần bật cá nhân hóa để lưu tương tác.' });
  const { productId = null, action, themeKey = null } = req.body || {};
  if (!['view', 'open_rail', 'save', 'unsave', 'relevant', 'irrelevant', 'theme'].includes(action) ||
      (productId !== null && !uuid(productId)) ||
      (themeKey !== null && !(action === 'open_rail' ? railKeys : THEME_KEYS).includes(themeKey)) ||
      (action === 'theme' && !themeKey) ||
      (action === 'open_rail' && !themeKey)) return bad(res, 'Tương tác không hợp lệ.');
  if (['view', 'save', 'unsave', 'relevant', 'irrelevant'].includes(action) && !productId) return bad(res, 'Thiếu sản phẩm.');
  if (productId) {
    const products = await repository.products();
    if (!products.some((product) => product.id === productId)) return bad(res, 'Sản phẩm không khả dụng.');
  }
  await repository.addInteraction(req.user.id, { productId, action, themeKey });
  res.status(201).json({ status: 'success' });
}));
router.delete('/history', verifyAuth, wrap(async (req, res) => {
  await repository.clearHistory(req.user.id);
  res.json({ status: 'success' });
}));

export default router;
