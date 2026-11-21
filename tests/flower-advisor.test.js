import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderFlowerAdvice, validateSelection, explicitMonth, filterExplicitPreferences, adviseFlowers, isFlowerQuestion, localFlowerAdvice } from '../src/services/flower-advisor.js';
import { wantsCatalog } from '../src/services/flower-conversation.js';

const catalog = JSON.parse(readFileSync(new URL('../scripts/flower-data.json', import.meta.url), 'utf8'));
const products = catalog.map((p) => ({ id:p.sku, name:p.name, price:p.price, stock:12, profile:p }));
const selection = { productIds:['FLOWER-01','FLOWER-16'],knowledgeIds:['birthday'],maxBudget:250000,month:11,season:'thu',followUp:'none' };

test('advice explains reasons without prices; inventory puts reasons before verified price', () => {
  const reason = 'Sắc hoa nhẹ nhàng giúp gửi lời cảm ơn thầy cô.';
  const chosen = { ...selection, reasons: [{ productId: 'FLOWER-16', text: reason }] };
  const advice = renderFlowerAdvice(chosen, products, { showCommerce: false });
  assert.match(advice.answer, /Sắc hoa nhẹ nhàng/);
  assert.doesNotMatch(advice.answer, /Giá:|Còn \d|vận chuyển|\d[.,]\d{3} đ/);
  assert.equal(advice.sources.length, 0);
  const inventory = renderFlowerAdvice(chosen, products, { showCommerce: true });
  assert.ok(inventory.answer.indexOf(reason) < inventory.answer.indexOf('Giá:'));
  assert.match(inventory.answer, /Còn 12/);
});

test('latest question controls commerce details, including during provider outages', () => {
  for (const message of ['Shop còn những loại nào cho ngày 20/11?', 'Bên mình có mẫu nào cho 20/11?', 'Còn những loại hoa nào?', 'Giá bao nhiêu?']) assert.equal(wantsCatalog({ message }), true, message);
  const input = { message: 'Nên chọn hoa nào tặng thầy cô 20/11?', history: [{ role: 'user', text: 'Shop còn hoa gì?' }] };
  assert.equal(wantsCatalog(input), false);
  const advice = localFlowerAdvice(input, products);
  assert.match(advice.answer, /biết ơn|trân trọng/);
  assert.doesNotMatch(advice.answer, /Giá:|Còn \d|\d[.,]\d{3} đ/);
  const inventory = localFlowerAdvice({ message: 'Shop còn hoa nào tặng thầy cô 20/11?' }, products);
  assert.match(inventory.answer, /Giá:/);
});
test('30 unique flower products with complete month/season/occasion metadata', () => {
  assert.equal(catalog.length,30);
  assert.equal(new Set(catalog.map((p) => p.sku)).size,30);
  assert.ok(catalog.every((p) => p.price > 0 && p.occasions.length && p.seasons.length && p.months.every((m)=>m>=1&&m<=12)));
  for(let month=1;month<=12;month++) assert.ok(catalog.some((p)=>p.months.includes(month)));
});
test('server enforces budget/month/season even if model selects unsuitable items', () => {
  const result=renderFlowerAdvice(selection,products);
  assert.ok(result.sources.some((s)=>s.id==='FLOWER-16'));
  assert.ok(!result.sources.some((s)=>s.id==='FLOWER-01'));
  const noMatch=renderFlowerAdvice({...selection,maxBudget:10000},products);
  assert.match(noMatch.answer,/chưa có sản phẩm phù hợp/);
});
test('out of stock products are not recommended', () => {
  const result=renderFlowerAdvice(selection,products.map((p)=>({...p,stock:0})));
  assert.ok(!result.sources.some((s)=>s.type==='product'));
});
test('unknown evidence IDs and invalid constraints fail closed', () => {
  assert.throws(()=>validateSelection({...selection,productIds:['invented']},products));
  assert.throws(()=>validateSelection({...selection,knowledgeIds:['free-delivery']},products));
  assert.throws(()=>validateSelection({...selection,month:13},products));
});

test('season question does not silently inherit current month', () => {
  assert.equal(explicitMonth({message:'Hoa nào hợp mùa hè?',history:[]}),0);
  assert.equal(explicitMonth({message:'Hoa tháng 11',history:[]}),11);
  assert.equal(explicitMonth({message:'Hoa tháng 12',history:[]}),12);
});

test('explicit colors, species exclusions and cats constrain recommendations', () => {
  const yellow=filterExplicitPreferences(products,{message:'Hoa tết màu vàng dưới 500k'});
  assert.ok(yellow.length>0);
  assert.ok(yellow.every(p=>p.profile.flower.includes('vàng')));
  const withoutRoses=filterExplicitPreferences(products,{message:'không thích hoa hồng'});
  assert.ok(withoutRoses.every(p=>!p.profile.flower.includes('hồng')));
  const cats=filterExplicitPreferences(products,{message:'Nhà có mèo'});
  assert.ok(cats.every(p=>!p.profile.flower.includes('lily')));
});

test('explicit catalog request still returns real products when Gemini times out or rate limits', async () => {
  const input={message:'Shop có sản phẩm hoa nào tặng thầy cô 20/11?',history:[]};
  assert.equal(isFlowerQuestion(input),true);
  assert.equal(isFlowerQuestion({message:'Tra cứu đơn hàng hoa của tôi'}),false);
  for (const status of [429,504]) {
    const result=await adviseFlowers(input,{
      db:{query:async()=>({rows:products.map(p=>({...p,attributes:[{name:'flower_profile',value:JSON.stringify(p.profile)}]}))})},
      client:{models:{generateContent:async()=>{throw Object.assign(new Error('provider error'),{status});}}}
    });
    assert.equal(result.mode,'catalog_fallback');
    assert.match(result.answer,/cẩm chướng/);
    assert.ok(result.sources.some(s=>s.type==='product'));
    for(const source of result.sources.filter(s=>s.type==='product')) assert.ok(products.find(p=>p.id===source.id).profile.occasions.includes('20/11'));
  }
});
