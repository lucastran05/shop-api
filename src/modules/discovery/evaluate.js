// Small, explicitly labeled fixture. Run: node src/modules/discovery/evaluate.js
import { performance } from 'node:perf_hooks';
import { rankProducts } from './ranking.js';
import { fallbackIntent } from './intent.js';

const products = [
  { id: 'rose', name: 'Bó hồng đỏ', category: 'Bó hoa', description: '', price: 250000, flower_species: [], is_pinned: false },
  { id: 'sunflower', name: 'Giỏ hướng dương vàng', category: 'Giỏ hoa', description: '', price: 220000, flower_species: [], is_pinned: false },
  { id: 'hydrangea', name: 'Bó cẩm tú cầu xanh dương', category: 'Bó hoa', description: '', price: 320000, flower_species: [], is_pinned: false },
  { id: 'carnation', name: 'Bình cẩm chướng hồng phấn', category: 'Bình hoa', description: '', price: 210000, flower_species: [], is_pinned: false },
  { id: 'lotus', name: 'Bó sen trắng', category: 'Bó hoa', description: '', price: 180000, flower_species: [], is_pinned: false },
  { id: 'orchid', name: 'Chậu lan tím', category: 'Chậu hoa', description: '', price: 350000, flower_species: [], is_pinned: false },
];
const scenarios = [
  { query: 'Cảm ơn mẹ', tags: ['gratitude', 'family'], relevant: ['carnation', 'hydrangea', 'orchid'] },
  { query: 'Chúc mừng khởi đầu mới', tags: ['celebration', 'new_beginning'], relevant: ['sunflower'] },
  { query: 'Một chút bình yên', tags: ['serene', 'gentle'], relevant: ['lotus', 'hydrangea'] },
  { query: 'Xoa dịu những dỗi hờn', tags: ['apology', 'gentle'], relevant: ['hydrangea', 'lotus'] },
];
const k = 3;
const rows = [];
for (const variant of ['baseline_rule', 'baseline_content', 'proposed']) {
  let hits = 0, total = 0, empty = 0, diversity = 0, latency = 0;
  const covered = new Set();
  for (const scenario of scenarios) {
    const start = performance.now();
    const items = rankProducts(products, {
      variant, tags: scenario.tags, query: scenario.query,
      season: 'autumn', limit: k,
    });
    latency += performance.now() - start;
    if (!items.length) empty++;
    hits += items.filter((item) => scenario.relevant.includes(item.id)).length;
    total += items.length;
    items.forEach((item) => covered.add(item.id));
    diversity += new Set(items.map((item) => item.category)).size / Math.max(items.length, 1);
  }
  rows.push({
    variant, scenarios: scenarios.length, k,
    precisionAtK: Number((hits / total).toFixed(3)),
    relevanceAtK: Number((hits / (scenarios.length * k)).toFixed(3)),
    catalogCoverage: Number((covered.size / products.length).toFixed(3)),
    categoryDiversity: Number((diversity / scenarios.length).toFixed(3)),
    emptyRate: Number((empty / scenarios.length).toFixed(3)),
    meanLatencyMs: Number((latency / scenarios.length).toFixed(3)),
  });
}
const keyword = scenarios.map((scenario) => ({
  query: scenario.query,
  fallbackIntent: fallbackIntent(scenario.query).intent,
  manuallyLabeledRelevantIds: scenario.relevant,
}));
console.log(JSON.stringify({ source: 'hand-labeled synthetic fixture; not production catalog or user behavior', rows, keyword }, null, 2));
