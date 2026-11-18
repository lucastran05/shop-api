// Read-only evaluation on the local catalog. Labels were written before observing ranks.
// Run in the API container after local seed: node src/modules/discovery/evaluate-catalog.js
import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import pool from '../../config/db.js';
import repository from './repository.js';
import { rankProducts } from './ranking.js';
import { evaluateCohereRerank } from './rerank.js';

const SCENARIOS = [
  { name: 'Làm hòa', query: 'Xoa dịu những dỗi hờn', tags: ['apology', 'gentle'], colors: [], relevant: ['Bó cẩm tú cầu xanh Biển Lặng', 'Chậu cẩm tú cầu xanh tím Chân Thành'] },
  { name: 'Cảm ơn mẹ', query: 'Tôi muốn cảm ơn mẹ', tags: ['gratitude', 'family'], colors: [], relevant: ['Giỏ cẩm chướng Tri Ân', 'Hoa cẩm chướng', 'Bó cẩm tú cầu xanh Biển Lặng', 'Chậu cẩm tú cầu xanh tím Chân Thành'] },
  { name: 'Tốt nghiệp', query: 'Chúc mừng tốt nghiệp rực rỡ', tags: ['celebration', 'encouragement'], colors: ['yellow', 'orange'], relevant: ['Bó hướng dương Nắng Mai', 'Hoa hướng dương', 'Bó đồng tiền Rạng Rỡ'] },
  { name: 'Ngày Nhà giáo', query: 'Tặng thầy cô dịp 20/11', tags: ['gratitude', 'respect'], colors: [], relevant: ['Giỏ cẩm chướng Tri Ân', 'Hoa cẩm chướng', 'Bó hoa ly Trang Nhã', 'Lan hồ điệp trắng'] },
  { name: 'Tím bình yên', query: 'Hoa tím nhạt bình yên', tags: ['serene', 'gentle'], colors: ['purple'], relevant: ['Bó oải hương tím An Nhiên', 'Bó cúc thạch thảo Tím Nhớ', 'Lan hồ điệp tím', 'Hoa violet'] },
  { name: 'Kỷ niệm', query: 'Hoa cho người yêu ngày kỷ niệm', tags: ['love', 'romantic'], colors: ['red', 'pink'], relevant: ['Bó hồng đỏ Ecuador', 'Giỏ hoa hồng phấn Ngọt Ngào', 'Bó mẫu đơn Hồng Tươi'] },
  { name: 'Khởi đầu', query: 'Món quà cho một khởi đầu mới', tags: ['new_beginning', 'fresh'], colors: [], relevant: ['Bó tulip Hà Lan', 'Chậu mai vàng Đầu Xuân', 'Chậu đào hồng Khởi Sắc', 'Bó hướng dương Nắng Mai'] },
  { name: 'Bạn bè', query: 'Một món quà dịu dàng cho bạn thân', tags: ['friendship', 'gentle'], colors: [], relevant: ['Bó baby trắng Tinh Khôi', 'Bó cúc họa mi Trong Trẻo'] },
  { name: 'Lời xin lỗi', query: 'Tôi muốn xin lỗi người bạn thân', tags: ['apology', 'gentle'], colors: ['white'], relevant: ['Bó cẩm tú cầu xanh Biển Lặng', 'Chậu cẩm tú cầu xanh tím Chân Thành', 'Bó baby trắng Tinh Khôi'] },
  { name: 'Chúc mừng', query: 'Hoa chúc mừng thành công', tags: ['celebration', 'encouragement'], colors: [], relevant: ['Bó hướng dương Nắng Mai', 'Hoa hướng dương', 'Bó đồng tiền Rạng Rỡ', 'Lẵng hoa khai trương Phát Tài'] },
];

const k = 5;
try {
  const products = await repository.products();
  if (products.length < 20) throw new Error('Evaluation needs at least 20 available products.');
  const names = new Set(products.map((product) => product.name));
  const missing = SCENARIOS.flatMap((scenario) => scenario.relevant.filter((name) => !names.has(name)));
  if (missing.length) throw new Error('Manual labels missing in catalog: ' + [...new Set(missing)].join(', '));
  const rows = [];
  for (const variant of ['baseline_rule', 'baseline_content', 'proposed', 'proposed_strict']) {
    let hits = 0, expected = 0, returned = 0, diversity = 0, empty = 0, latency = 0;
    const covered = new Set();
    const perScenario = [];
    for (const scenario of SCENARIOS) {
      const start = performance.now();
      const items = rankProducts(products, {
        variant: variant === 'proposed_strict' ? 'proposed' : variant,
        tags: scenario.tags, colors: scenario.colors, query: scenario.query,
        season: 'autumn', limit: k,
        strict: variant === 'proposed_strict' ? 'semantic' : 'none',
      });
      latency += performance.now() - start;
      const relevant = new Set(scenario.relevant);
      const found = items.filter((product) => relevant.has(product.name)).length;
      hits += found;
      expected += relevant.size;
      returned += items.length;
      if (!items.length) empty++;
      diversity += new Set(items.map((item) => item.category)).size / Math.max(items.length, 1);
      items.forEach((item) => covered.add(item.id));
      perScenario.push({ scenario: scenario.name, hits: found, relevant: relevant.size, top: items.map((item) => item.name) });
    }
    rows.push({
      variant, scenarios: SCENARIOS.length, k, products: products.length,
      precisionAtK: Number((hits / Math.max(returned, 1)).toFixed(3)),
      recallAtK: Number((hits / expected).toFixed(3)),
      catalogCoverage: Number((covered.size / products.length).toFixed(3)),
      categoryDiversity: Number((diversity / SCENARIOS.length).toFixed(3)),
      emptyRate: Number((empty / SCENARIOS.length).toFixed(3)),
      meanLatencyMs: Number((latency / SCENARIOS.length).toFixed(3)),
      perScenario,
    });
  }
  if (process.env.DISCOVERY_EVALUATE_COHERE === '1') {
    let hits = 0, returned = 0, diversity = 0, latency = 0, fallbacks = 0;
    const covered = new Set();
    const perScenario = [];
    for (const scenario of SCENARIOS) {
      const shortlist = rankProducts(products, { tags: scenario.tags, colors: scenario.colors,
        query: scenario.query, season: 'autumn', limit: 30, strict: 'none' });
      const start = performance.now();
      const reranked = await evaluateCohereRerank(scenario.query, shortlist);
      latency += performance.now() - start;
      if (reranked.status !== 'enabled') fallbacks++;
      const items = (reranked.items || shortlist).slice(0, k);
      const found = items.filter((product) => scenario.relevant.includes(product.name)).length;
      hits += found; returned += items.length;
      diversity += new Set(items.map((item) => item.category)).size / Math.max(items.length, 1);
      items.forEach((item) => covered.add(item.id));
      perScenario.push({ scenario: scenario.name, status: reranked.status, hits: found,
        relevant: scenario.relevant.length, top: items.map((item) => item.name) });
    }
    rows.push({ variant: 'cohere_candidate_30', scenarios: SCENARIOS.length, k,
      products: products.length, precisionAtK: Number((hits / Math.max(returned, 1)).toFixed(3)),
      recallAtK: Number((hits / SCENARIOS.reduce((n, row) => n + row.relevant.length, 0)).toFixed(3)),
      catalogCoverage: Number((covered.size / products.length).toFixed(3)),
      categoryDiversity: Number((diversity / SCENARIOS.length).toFixed(3)),
      fallbackRate: fallbacks / SCENARIOS.length,
      meanLatencyMs: Number((latency / SCENARIOS.length).toFixed(3)), perScenario });
  }
  console.log(JSON.stringify({ source: 'local demo catalog, manual binary labels set before ranking; not user behavior', rows }, null, 2));
} catch (error) {
  console.error('Discovery catalog evaluation failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
