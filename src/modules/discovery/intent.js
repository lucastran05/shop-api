import { normalize } from './semantic-data.js';
import { THEME_KEYS } from './themes.js';

const RULES = [
  { words: ['cảm ơn', 'biết ơn', 'tri ân', 'thầy cô', 'mẹ'], intent: 'gratitude', themeKey: 'gratitude', tags: ['gratitude', 'respect'] },
  { words: ['xin lỗi', 'dỗi', 'hàn gắn', 'làm hòa'], intent: 'apology', themeKey: 'gentle', tags: ['apology', 'gentle'] },
  { words: ['tốt nghiệp', 'chúc mừng', 'khai trương', 'thành công'], intent: 'celebration', themeKey: 'sunrise', tags: ['celebration', 'encouragement'] },
  { words: ['bắt đầu', 'khởi đầu', 'hành trình mới'], intent: 'new_beginning', themeKey: 'beginning', tags: ['new_beginning', 'fresh'] },
  { words: ['bình yên', 'áp lực', 'dịu lại', 'thư giãn'], intent: 'comfort', themeKey: 'garden', tags: ['serene', 'gentle'] },
  { words: ['người yêu', 'tình yêu', 'kỷ niệm', 'valentine'], intent: 'love', themeKey: 'gentle', tags: ['love', 'romantic'] },
  { words: ['hoài niệm', 'nhớ', 'pastel'], intent: 'nostalgia', themeKey: 'lavender', tags: ['gentle', 'serene'] },
];
const COLOR_WORDS = {
  red: ['đỏ', 'red'], pink: ['hồng phấn', 'màu hồng', 'sắc hồng', 'pink'], yellow: ['vàng', 'yellow'],
  purple: ['tím', 'purple'], white: ['trắng', 'white'], blue: ['xanh dương', 'xanh ngọc', 'xanh tím', 'blue'],
  green: ['xanh lá', 'xanh la', 'lá xanh', 'green'],
  orange: ['màu cam', 'sắc cam', 'orange'],
};
export const INTENTS = ['unknown', 'gratitude', 'apology', 'celebration', 'new_beginning', 'comfort', 'love', 'nostalgia'];
export const COLORS = Object.keys(COLOR_WORDS);
export const STYLES = ['unknown', 'gentle', 'bright', 'elegant', 'minimal'];
export const SEMANTIC_TAGS = ['love', 'romantic', 'gratitude', 'celebration', 'fresh', 'encouragement', 'gentle', 'apology', 'family', 'respect', 'elegant', 'serene', 'friendship', 'new_beginning', 'warm'];
const hasPhrase = (text, phrase) =>
  (' ' + normalize(text).replace(/[^a-z0-9]+/g, ' ') + ' ').includes(
    ' ' + normalize(phrase).replace(/[^a-z0-9]+/g, ' ').trim() + ' ');

export function fallbackIntent(input) {
  const text = normalize(input);
  const selected = RULES.find((rule) => rule.words.some((word) => hasPhrase(text, word)));
  const preferredColors = COLORS.filter((color) => COLOR_WORDS[color].some((word) => hasPhrase(text, word)));
  const budgetMatch = text.match(/(?:duoi|toi da|khoang)\s*(\d[\d.,]*)\s*(trieu|nghin|k|d|dong)?/);
  let budget = null;
  if (budgetMatch) {
    const amount = Number(budgetMatch[1].replace(/[.,]/g, ''));
    const multiplier = budgetMatch[2] === 'trieu' ? 1000000 : ['nghin', 'k'].includes(budgetMatch[2]) ? 1000 : 1;
    if (Number.isFinite(amount) && amount > 0) budget = Math.min(amount * multiplier, 100000000);
  }
  return {
    intent: selected?.intent || 'unknown', occasion: null, recipient: null,
    emotionalTone: selected?.intent || 'unknown', semanticTags: selected?.tags || [],
    preferredColors, style: 'unknown', budget, avoid: [],
    themeKey: selected?.themeKey || 'garden', confidence: selected ? 0.55 : 0.2,
    interpretation: selected ? 'Gợi ý từ những từ khóa và sắc thái bạn chia sẻ.' : 'Mình sẽ bắt đầu từ những lựa chọn đa dạng trong cửa hàng.',
    title: null, intro: null,
  };
}

export function validateIntent(value) {
  if (!value || typeof value !== 'object' || !INTENTS.includes(value.intent)) throw new Error('Invalid AI intent');
  if (!THEME_KEYS.includes(value.themeKey)) throw new Error('Invalid AI theme');
  if (!Array.isArray(value.semanticTags) || value.semanticTags.length > 8 ||
      !value.semanticTags.every((tag) => SEMANTIC_TAGS.includes(tag))) throw new Error('Invalid AI tags');
  if (!Array.isArray(value.preferredColors) || value.preferredColors.length > 4 ||
      !value.preferredColors.every((color) => COLORS.includes(color))) throw new Error('Invalid AI colors');
  if (!STYLES.includes(value.style) || typeof value.confidence !== 'number' ||
      value.confidence < 0 || value.confidence > 1) throw new Error('Invalid AI fields');
  for (const key of ['occasion', 'recipient', 'emotionalTone', 'interpretation', 'title', 'intro']) {
    if (value[key] !== null && value[key] !== undefined &&
        (typeof value[key] !== 'string' || value[key].length > 240)) throw new Error('Invalid AI text');
  }
  if (value.budget !== null && value.budget !== undefined &&
      (!Number.isInteger(value.budget) || value.budget < 0 || value.budget > 100000000)) throw new Error('Invalid AI budget');
  if (!Array.isArray(value.avoid) || value.avoid.length > 5 ||
      !value.avoid.every((item) => typeof item === 'string' && item.length <= 40)) throw new Error('Invalid AI avoid');
  return {
    intent: value.intent, occasion: value.occasion || null, recipient: value.recipient || null,
    emotionalTone: value.emotionalTone || 'unknown', semanticTags: value.semanticTags,
    preferredColors: value.preferredColors, style: value.style, budget: value.budget ?? null,
    avoid: value.avoid, themeKey: value.themeKey, confidence: value.confidence,
    interpretation: value.interpretation || '', title: value.title || null, intro: value.intro || null,
  };
}
