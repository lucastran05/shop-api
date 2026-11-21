// Curated, editable cultural associations. These are suggestions, not universal meanings.
const FLOWERS = [
  { terms: ['hồng', 'rose'], tags: ['love', 'romantic', 'gratitude'], colors: ['red', 'pink'], seasons: ['spring', 'summer'], meaning: 'thường gợi sự trân trọng và tình cảm' },
  { terms: ['hướng dương', 'sunflower'], tags: ['celebration', 'fresh', 'encouragement'], colors: ['yellow'], seasons: ['summer'], meaning: 'thường gợi sự lạc quan' },
  { terms: ['cẩm tú cầu', 'hydrangea'], tags: ['gratitude', 'gentle', 'apology'], colors: ['blue', 'pink', 'purple'], seasons: ['summer'], meaning: 'thường gợi sự chân thành' },
  { terms: ['cẩm chướng', 'carnation'], tags: ['gratitude', 'family', 'respect'], colors: ['pink', 'red', 'white'], seasons: ['spring'], meaning: 'thường gắn với lời biết ơn' },
  { terms: ['tulip'], tags: ['love', 'fresh', 'new_beginning'], colors: ['pink', 'yellow', 'white'], seasons: ['spring'], meaning: 'thường gợi khởi đầu tươi mới' },
  { terms: ['lan', 'orchid'], tags: ['elegant', 'respect', 'gratitude'], colors: ['white', 'purple'], seasons: ['winter', 'spring'], meaning: 'thường gợi sự tinh tế' },
  { terms: ['sen', 'lotus'], tags: ['serene', 'respect', 'gentle'], colors: ['pink', 'white'], seasons: ['summer'], meaning: 'thường gợi sự thanh nhã' },
  { terms: ['ly', 'lily'], tags: ['respect', 'celebration', 'elegant'], colors: ['white', 'pink'], seasons: ['summer'], meaning: 'thường gợi sự trang nhã' },
  { terms: ['cúc', 'cúc họa mi', 'cúc thạch thảo', 'cúc vạn thọ', 'daisy', 'chrysanthemum'], tags: ['gratitude', 'friendship', 'gentle'], colors: ['yellow', 'white'], seasons: ['autumn'], meaning: 'thường gợi sự ấm áp' },
  { terms: ['baby', 'gypsophila'], tags: ['gentle', 'friendship', 'love'], colors: ['white'], seasons: ['spring'], meaning: 'thường gợi nét dịu dàng' },
  { terms: ['mẫu đơn', 'peony'], tags: ['celebration', 'elegant'], colors: ['pink'], seasons: ['spring'], meaning: 'thường gợi vẻ rực rỡ' },
  { terms: ['oải hương', 'lavender'], tags: ['serene', 'gentle'], colors: ['purple'], seasons: ['summer'], meaning: 'thường gợi sự thư thái' },
  { terms: ['đồng tiền', 'gerbera'], tags: ['celebration', 'friendship'], colors: ['yellow', 'orange', 'pink'], seasons: ['spring'], meaning: 'thường gợi niềm vui' },
  { terms: ['mai', 'apricot'], tags: ['new_beginning', 'celebration'], colors: ['yellow'], seasons: ['spring'], meaning: 'thường gắn với ngày đầu năm' },
  { terms: ['đào', 'peach blossom'], tags: ['new_beginning', 'celebration'], colors: ['pink'], seasons: ['spring'], meaning: 'thường gắn với mùa xuân' },
];

export const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const contains = (text, term) => {
  const haystack = ' ' + normalize(text).replace(/[^a-z0-9]+/g, ' ') + ' ';
  const needle = ' ' + normalize(term).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  return needle.trim().length > 0 && haystack.includes(needle);
};
export function describeProduct(product) {
  const species = Array.isArray(product.flower_species) ? product.flower_species.map(normalize) : [];
  const text = [product.name, product.description, product.category, ...species].join(' ');
  const matched = FLOWERS.filter((flower) => flower.terms.some((term) =>
    species.length ? species.includes(normalize(term)) : contains(product.name + ' ' + product.description, term)));
  const tags = [...new Set(matched.flatMap((item) => item.tags))];
  for (const [words, additions] of [
    [['khai trương', 'tốt nghiệp', 'chúc mừng'], ['celebration']],
    [['tri ân', 'cảm ơn', 'thầy cô'], ['gratitude', 'respect']],
    [['xin lỗi', 'làm hòa'], ['apology', 'gentle']],
    [['đám cưới', 'cô dâu', 'kỷ niệm'], ['love']],
  ]) if (words.some((word) => contains(text, word))) tags.push(...additions);
  const exactColors = [];
  const seasons = [...new Set(matched.flatMap((item) => item.seasons))];
  for (const [color, words] of Object.entries({
    red: ['đỏ', 'red'], pink: ['hồng phấn', 'màu hồng', 'pink'], yellow: ['vàng', 'yellow'],
    white: ['trắng', 'white'], purple: ['tím', 'purple'], blue: ['xanh dương', 'xanh ngọc', 'xanh tím', 'blue'],
    green: ['xanh lá', 'xanh la', 'lá xanh', 'green'],
    orange: ['màu cam', 'sắc cam', 'orange'],
  })) if (words.some((word) => contains(text, word))) exactColors.push(color);
  const colors = exactColors.length ? exactColors : matched.flatMap((item) => item.colors);
  return { tags: [...new Set(tags)], colors: [...new Set(colors)], seasons, meaning: matched[0]?.meaning || null, searchText: normalize(text) };
}
