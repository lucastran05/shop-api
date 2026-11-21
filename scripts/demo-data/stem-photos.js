// Hàm thuần cho `npm run import:stems`: dựng truy vấn Pexels và chọn ảnh thấy rõ một cành đúng loại hoa.
import { STEM_PRODUCTS } from './catalog.js';

// Từ khóa tiếng Anh theo loại hoa (khớp với tên sản phẩm tiếng Việt và mẫu vẽ trong stem-art.js)
export const FLOWER_TERMS = {
  rose: { match: /hồng|rose/i, words: ['rose'] },
  baby: { match: /baby|gypsophila/i, words: ['gypsophila', "baby's breath", 'babys breath'] },
  daisy: { match: /cúc|daisy|chrysanthemum/i, words: ['daisy', 'chrysanthemum'] },
  tulip: { match: /tulip/i, words: ['tulip'] },
  sunflower: { match: /hướng dương|sunflower/i, words: ['sunflower'] },
};

const COLOR_TERMS = [
  [/hồng phấn|pastel/i, 'pink'],
  [/đỏ/i, 'red'],
  [/hồng/i, 'pink'],
  [/trắng/i, 'white'],
  [/vàng/i, 'yellow'],
  [/cam/i, 'orange'],
  [/tím/i, 'purple'],
  [/xanh/i, 'blue'],
];

const FALLBACK_COLORS = { red: '#c81d3a', pink: '#ec7fa0', white: '#f5efe6', yellow: '#f7c948', orange: '#f08a3c', purple: '#8e6cc2', blue: '#6f9fd8' };

export const colorWord = (color = '') => COLOR_TERMS.find(([pattern]) => pattern.test(color))?.[1] || '';

export function flowerOf(productName = '') {
  return Object.entries(FLOWER_TERMS).find(([, terms]) => terms.match.test(productName))?.[0] || null;
}

// Cấu hình sẵn theo id biến thể trong demo-data/catalog.js (query, pexels_id chọn thủ công, màu vẽ dự phòng)
export function stemConfig(product, variant) {
  for (const stemProduct of STEM_PRODUCTS) {
    const configured = stemProduct.variants.find((item) => item.id === String(variant.id));
    if (configured) {
      return {
        flower: stemProduct.flower,
        query: configured.query,
        pexels_id: configured.pexels_id || null,
        color: configured.colors[0],
      };
    }
  }
  // Sản phẩm do quản trị thêm: suy ra từ tên và màu
  const flower = flowerOf(product.name);
  const color = colorWord(variant.color);
  return {
    flower,
    query: flower ? `single ${color} ${FLOWER_TERMS[flower].words[0]} stem`.replace(/\s+/g, ' ') : null,
    pexels_id: null,
    color: FALLBACK_COLORS[color] || '#e58fa8',
  };
}

// Chấm điểm kết quả Pexels: ưu tiên ảnh dọc, mô tả đúng loại hoa và có "single/stem",
// loại ảnh bó, cánh đồng, vườn (nhiều bông).
export function scorePhoto(photo, { flower, color }) {
  const alt = String(photo?.alt || '').toLowerCase();
  const words = FLOWER_TERMS[flower]?.words || [];
  if (!words.some((word) => alt.includes(word))) return -Infinity;
  let score = 3;
  if (/\b(single|one|stem|isolated|close-?up)\b/.test(alt)) score += 2;
  if (color && alt.includes(colorWord(color) || color)) score += 1;
  if (/\b(bouquet|bunch|field|garden|farm|arrangement|many)\b/.test(alt)) score -= 3;
  if (Number(photo.height) > Number(photo.width)) score += 1;
  return score;
}

export function pickPhoto(photos, { flower, colorName }) {
  let best = null;
  let bestScore = -Infinity;
  for (const photo of photos || []) {
    const score = scorePhoto(photo, { flower, color: colorName });
    if (score > bestScore) {
      best = photo;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

// Thông tin ghi nguồn theo hướng dẫn của Pexels
export const attribution = (photo) => ({
  pexels_id: photo.id,
  photographer: photo.photographer || '',
  photographer_url: photo.photographer_url || '',
  pexels_url: photo.url || `https://www.pexels.com/photo/${photo.id}/`,
});

// PNG có kênh alpha (color type 4/6 hoặc chunk tRNS), WebP có cờ alpha trong VP8X hoặc là VP8L
export function hasTransparency(buffer, mimetype) {
  if (mimetype === 'image/png') return [4, 6].includes(buffer[25]) || buffer.includes(Buffer.from('tRNS'));
  if (mimetype === 'image/webp') {
    const chunk = buffer.toString('ascii', 12, 16);
    return chunk === 'VP8L' || (chunk === 'VP8X' && (buffer[20] & 0x10) !== 0);
  }
  return false;
}
