import test from 'node:test';
import assert from 'node:assert/strict';
import { vietnamContext } from '../src/modules/discovery/calendar.js';
import { fallbackIntent, validateIntent } from '../src/modules/discovery/intent.js';
import { interpretWithGemini } from '../src/modules/discovery/gemini.js';
import { interpretWithGroq } from '../src/modules/discovery/groq.js';
import { interpretWithProviders } from '../src/modules/discovery/providers.js';
import { evaluateCohereRerank } from '../src/modules/discovery/rerank.js';
import { safeProviderError } from '../src/modules/discovery/provider-diagnostics.js';
import { discoverRails, rankProducts } from '../src/modules/discovery/ranking.js';
import { DiscoveryService } from '../src/modules/discovery/service.js';
import { describeProduct } from '../src/modules/discovery/semantic-data.js';

const rose = { id: '00000000-0000-0000-0000-000000000001', name: 'Hoa hồng đỏ', description: '', category: 'Bó hoa', price: 200000, flower_species: [], is_pinned: false };
const sunflower = { id: '00000000-0000-0000-0000-000000000002', name: 'Hướng dương', description: '', category: 'Giỏ hoa', price: 150000, flower_species: [], is_pinned: false };
const repo = (products = [rose, sunflower], consent = false) => ({
  products: async () => products,
  preference: async () => ({ consent, favorite_colors: ['yellow'], favorite_themes: [] }),
  occasions: async () => [],
  interactions: async () => [{ product_id: sunflower.id, action: 'relevant' }, { product_id: rose.id, action: 'irrelevant' }],
});

test('Vietnam holiday appears before and on 20/11, then loses priority', () => {
  const before = vietnamContext(new Date('2026-11-16T02:00:00Z'));
  const on = vietnamContext(new Date('2026-11-19T18:00:00Z'));
  const after = vietnamContext(new Date('2026-11-20T18:00:00Z'));
  assert.equal(before.holidays[0].key, 'teachers');
  assert.equal(before.holidays[0].daysUntil, 4);
  assert.equal(on.holidays[0].daysUntil, 0);
  assert.ok(!after.holidays.some((day) => day.key === 'teachers'));
});

test('personal dates use Vietnam day and can be disabled', () => {
  const events = [{ title: 'Sinh nhật', month: 11, day: 22, reminder_days: 7, enabled: true }, { title: 'Ẩn', month: 11, day: 18, reminder_days: 7, enabled: false }];
  assert.deepEqual(vietnamContext(new Date('2026-11-16T00:00:00Z'), events).occasions.map((day) => day.title), ['Sinh nhật']);
});

test('29 February repeats on 1 March in a non-leap year', () => {
  const context = vietnamContext(new Date('2026-02-26T18:00:00Z'), [
    { title: 'Dịp nhuận', month: 2, day: 29, reminder_days: 7, enabled: true },
  ]);
  assert.equal(context.occasions[0].daysUntil, 2);
});

test('Discover keeps only contextual rails without repeated products', async () => {
  const products = Array.from({ length: 20 }, (_, index) => ({
    ...rose, id: String(index).padStart(36, '0'), name: `Hoa cẩm chướng ${index}`,
    flower_species: ['cẩm chướng'],
  }));
  const service = new DiscoveryService({ repo: repo(products), now: () => new Date('2026-11-16T02:00:00Z') });
  const rails = (await service.rails(null)).rails;
  assert.ok(rails.length > 0 && rails.length <= 3);
  assert.ok(rails.every((rail) => !['featured', 'new'].includes(rail.key) && rail.items.length <= 5));
  const ids = rails.flatMap((rail) => rail.items.map((item) => item.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('Discover color, theme and teacher rails keep their own strict filters', () => {
  const products = [
    ...Array.from({ length: 5 }, (_, index) => ({
      ...rose, id: `gratitude-${index}`, name: `Bó cẩm chướng tri ân ${index}`,
      flower_species: ['cẩm chướng'],
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      ...sunflower, id: `yellow-${index}`, name: `Bó hướng dương vàng ${index}`,
      flower_species: ['hướng dương'],
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      ...rose, id: `serene-${index}`, name: `Bó oải hương tím ${index}`,
      flower_species: ['oải hương'],
    })),
  ];
  const context = {
    season: 'winter', occasions: [],
    holidays: [{ key: 'teachers', label: 'Ngày Nhà giáo Việt Nam', daysUntil: 4, tags: ['gratitude', 'respect'] }],
  };
  const preference = { consent: true, favorite_colors: ['yellow'], favorite_themes: ['garden'] };
  const rails = discoverRails(products, context, preference, []);
  const byKey = Object.fromEntries(rails.map((rail) => [rail.key, rail]));
  assert.deepEqual(rails.map((rail) => rail.key), ['holiday', 'for_you', 'themes']);
  assert.ok(byKey.holiday.items.every((item) => {
    const tags = describeProduct(item).tags;
    return tags.includes('gratitude') || tags.includes('respect');
  }));
  assert.ok(byKey.for_you.items.every((item) => describeProduct(item).colors.includes('yellow')));
  assert.ok(byKey.themes.items.every((item) => describeProduct(item).tags.includes('serene')));
  const ids = rails.flatMap((rail) => rail.items.map((item) => item.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('refining changes theme and products without calling Gemini', async () => {
  let calls = 0;
  const service = new DiscoveryService({ repo: repo(), interpret: async () => { calls++; return { status: 'unavailable', intent: null }; } });
  const result = await service.refine('Chúc mừng tốt nghiệp', 'bright', null);
  assert.equal(result.mode, 'refined');
  assert.equal(result.themeKey, 'sunrise');
  assert.equal(calls, 0);
});

test('ranking uses feedback only with consent and respects budget', () => {
  const noConsent = rankProducts([rose, sunflower], { preference: { consent: false, favorite_colors: ['yellow'] }, interactions: [{ product_id: sunflower.id, action: 'relevant' }] });
  const consent = rankProducts([rose, sunflower], { preference: { consent: true, favorite_colors: ['yellow'] }, interactions: [{ product_id: sunflower.id, action: 'relevant' }] });
  assert.equal(consent[0].id, sunflower.id);
  assert.equal(noConsent.length, 2);
  assert.deepEqual(rankProducts([rose, sunflower], { budget: 160000 }).map((item) => item.id), [sunflower.id]);
});

test('latest save state and negative feedback affect ranking', () => {
  const pref = { consent: true, favorite_colors: [], favorite_themes: [] };
  const saved = rankProducts([rose, sunflower], {
    preference: pref, interactions: [{ product_id: sunflower.id, action: 'save' }],
  });
  assert.equal(saved[0].id, sunflower.id);
  const removed = rankProducts([rose, sunflower], {
    preference: pref, interactions: [
      { product_id: sunflower.id, action: 'unsave' },
      { product_id: sunflower.id, action: 'save' },
      { product_id: sunflower.id, action: 'irrelevant' },
    ],
  });
  assert.equal(removed[0].id, rose.id);
});

test('species metadata does not confuse similarly named flowers', () => {
  const lotus = describeProduct({ name: 'Hoa sen cạn', description: '', category: 'Hoa', flower_species: ['sen cạn'] });
  const safflower = describeProduct({ name: 'Hoa hồng hoa', description: '', category: 'Hoa', flower_species: ['hồng hoa'] });
  assert.ok(!lotus.tags.includes('serene'));
  assert.ok(!safflower.tags.includes('romantic'));
});

test('blue and green are distinct preference and catalog colors', () => {
  const blueFlower = describeProduct({ name: 'Bó cẩm tú cầu xanh dương', description: '', category: 'Hoa', flower_species: ['cẩm tú cầu'] });
  const greenFlower = describeProduct({ name: 'Bó cúc xanh lá', description: '', category: 'Hoa', flower_species: [] });
  assert.ok(blueFlower.colors.includes('blue'));
  assert.ok(!blueFlower.colors.includes('green'));
  assert.ok(greenFlower.colors.includes('green'));
  assert.ok(!greenFlower.colors.includes('blue'));
  assert.ok(fallbackIntent('Tôi muốn hoa màu xanh lá').preferredColors.includes('green'));
  assert.ok(fallbackIntent('Tôi muốn hoa màu xanh dương').preferredColors.includes('blue'));
});

test('strict semantic and explicit purple preference exclude unrelated products', async () => {
  assert.deepEqual(rankProducts([rose, sunflower], { tags: ['love'], strict: 'semantic' }).map((item) => item.id), [rose.id]);
  const service = new DiscoveryService({ repo: repo(), interpret: async () => ({
    status: 'enabled',
    intent: { ...fallbackIntent('Bình yên'), semanticTags: ['serene'], preferredColors: ['purple'], themeKey: 'lavender' },
  }) });
  const result = await service.world('Một bó hoa tím nhạt bình yên', null);
  assert.equal(result.items.length, 0);
});

test('apology intent outranks friendship and ignores AI-invented exclusions', async () => {
  const hydrangea = { ...rose, id: 'hydrangea', name: 'Bó cẩm tú cầu xanh', flower_species: ['cẩm tú cầu'] };
  const daisy = { ...sunflower, id: 'daisy', name: 'Bó cúc họa mi', flower_species: ['cúc họa mi'] };
  const ranked = rankProducts([daisy, hydrangea], {
    tags: ['apology', 'gentle', 'friendship'], primaryTag: 'apology', strict: 'semantic', season: 'autumn',
  });
  assert.equal(ranked[0].id, hydrangea.id);
  const service = new DiscoveryService({ repo: repo([daisy, hydrangea]), interpret: async () => ({
    status: 'enabled',
    intent: { ...fallbackIntent('Xin lỗi'), semanticTags: ['apology', 'gentle'], avoid: ['cẩm tú cầu'] },
  }) });
  const world = await service.world('Tôi muốn xin lỗi bạn', null);
  assert.ok(world.items.some((item) => item.id === hydrangea.id));
  assert.deepEqual(world.intent.avoid, []);
});

test('fallback parses meaning, color and budget without claiming AI', () => {
  const result = fallbackIntent('Xin lỗi, muốn hoa hồng phấn dưới 500 nghìn');
  assert.equal(result.intent, 'apology');
  assert.ok(result.preferredColors.includes('pink'));
  assert.equal(result.budget, 500000);
  assert.deepEqual(fallbackIntent('Cảm ơn mẹ dưới 500 nghìn').preferredColors, []);
  assert.deepEqual(fallbackIntent('Xoa dịu những dỗi hờn.').preferredColors, []);
  assert.equal(fallbackIntent('Người yêu thích sự bình yên').intent, 'comfort');
});

test('AI romantic misread of “người yêu thích sự bình yên” is corrected', async () => {
  const lavender = { ...rose, id: 'lavender', name: 'Bó oải hương tím', flower_species: ['oải hương'] };
  const service = new DiscoveryService({
    repo: repo([lavender]),
    interpret: async () => ({ status: 'enabled', intent: {
      ...fallbackIntent('hoa cho người yêu'), intent: 'love',
      semanticTags: ['love', 'romantic'], preferredColors: ['purple'], themeKey: 'lavender',
    } }),
  });
  const world = await service.world('Một bó hoa tím nhạt dành cho người yêu thích sự bình yên.', null);
  assert.equal(world.mode, 'ai');
  assert.equal(world.intent.intent, 'comfort');
  assert.deepEqual(world.intent.semanticTags, ['serene', 'gentle']);
  assert.equal(world.themeKey, 'garden');
  assert.equal(world.items[0].id, lavender.id);
});

test('explicit dỗi hờn keeps apology meaning when AI labels it comfort', async () => {
  const hydrangea = { ...rose, id: 'hydrangea', name: 'Bó cẩm tú cầu xanh Biển Lặng', flower_species: ['cẩm tú cầu'] };
  const service = new DiscoveryService({
    repo: repo([hydrangea]),
    interpret: async () => ({ status: 'enabled', intent: {
      ...fallbackIntent('bình yên'), intent: 'comfort', semanticTags: ['gentle', 'warm'],
    } }),
  });
  const world = await service.world('Xoa dịu những dỗi hờn.', null);
  assert.equal(world.intent.intent, 'apology');
  assert.equal(world.themeKey, 'gentle');
  assert.equal(world.items[0].id, hydrangea.id);
});

test('invalid AI schema is rejected', () => {
  assert.throws(() => validateIntent({ intent: 'invented', themeKey: 'garden' }));
});

test('Gemini adapter handles missing key, invalid JSON and valid response', async () => {
  assert.equal((await interpretWithGemini('test', { key: '' })).status, 'unconfigured');
  const fakeFetch = (text) => async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  });
  const invalid = await interpretWithGemini('invalid-test', { key: 'test', fetchImpl: fakeFetch('{oops') });
  assert.equal(invalid.status, 'invalid_response');
  const intent = fallbackIntent('Cảm ơn');
  const valid = await interpretWithGemini('valid-test', { key: 'test', fetchImpl: fakeFetch(JSON.stringify(intent)) });
  assert.equal(valid.status, 'enabled');
  const timeout = await interpretWithGemini('timeout-test', { key: 'test', fetchImpl: async () => { throw new Error('timeout'); } });
  assert.equal(timeout.status, 'temporarily_unavailable');
  const quota = await interpretWithGemini('quota-test', { key: 'test', fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.equal(quota.status, 'rate_limited');
  const badEnum = await interpretWithGemini('enum-test', { key: 'test', fetchImpl: fakeFetch(JSON.stringify({ ...intent, themeKey: 'injected' })) });
  assert.equal(badEnum.status, 'invalid_response');
});

test('service uses real candidates, fallback and empty catalog', async () => {
  const service = new DiscoveryService({ repo: repo(), interpret: async () => ({ status: 'unconfigured', intent: null }), now: () => new Date('2026-11-16T00:00:00Z') });
  const rails = await service.rails(null);
  assert.ok(rails.rails.length > 0);
  const world = await service.world('Cảm ơn mẹ', null);
  assert.equal(world.mode, 'fallback');
  assert.ok(world.items.every((item) => [rose.id, sunflower.id].includes(item.id)));
  const empty = new DiscoveryService({ repo: repo([]), interpret: async () => ({ status: 'unavailable', intent: null }) });
  assert.equal((await empty.rails(null)).catalogEmpty, true);
  assert.equal((await empty.world('Bình yên', null)).items.length, 0);
});

test('Gemini quota switches to validated Groq intent; unavailable Groq falls back', async () => {
  const input = 'Cảm ơn mẹ';
  const valid = fallbackIntent(input);
  const groqFetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(valid) } }] }) });
  const groq = (text) => interpretWithGroq(text, { key: 'test', fetchImpl: groqFetch });
  const switched = await interpretWithProviders(input, { gemini: async () => ({ status: 'rate_limited', intent: null }), groq });
  assert.equal(switched.provider, 'groq');
  assert.equal(switched.intent.intent, 'gratitude');
  const outage = await interpretWithProviders(input, {
    gemini: async () => ({ status: 'temporarily_unavailable', intent: null }), groq,
  });
  assert.equal(outage.provider, 'groq');
  assert.equal(outage.intent.intent, 'gratitude');
  const failed = await interpretWithProviders(input, { gemini: async () => ({ status: 'rate_limited', intent: null }), groq: async () => ({ status: 'unavailable', intent: null }) });
  const world = await new DiscoveryService({ repo: repo(), interpret: async () => failed }).world(input, null);
  assert.equal(world.mode, 'fallback');
  assert.equal(world.aiStatus, 'rate_limited');
  assert.ok(world.items.length > 0);
});

test('Groq rejects invalid schema and missing key', async () => {
  assert.equal((await interpretWithGroq('test', { key: '' })).status, 'unconfigured');
  const invalid = await interpretWithGroq('test', { key: 'test', fetchImpl: async () => ({
    ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ ...fallbackIntent('test'), themeKey: 'fake' }) } }] }),
  }) });
  assert.equal(invalid.status, 'invalid_response');
});

test('Groq request uses documented strict structured output contract', async () => {
  const valid = fallbackIntent('Cáº£m Æ¡n máº¹');
  let requestUrl, request;
  const result = await interpretWithGroq('Cáº£m Æ¡n máº¹', { key: 'test-secret', fetchImpl: async (url, options) => {
    requestUrl = url;
    request = { ...options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(valid) } }] }) };
  } });
  assert.equal(result.status, 'enabled');
  assert.equal(requestUrl, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers['Content-Type'], 'application/json');
  assert.equal(request.headers.Authorization, 'Bearer test-secret');
  assert.equal(request.body.response_format.type, 'json_schema');
  assert.equal(request.body.response_format.json_schema.strict, true);
  const schema = request.body.response_format.json_schema.schema;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
  assert.equal(request.body.model, process.env.DISCOVERY_GROQ_MODEL || 'openai/gpt-oss-20b');
  assert.equal(request.body.reasoning_effort, 'low');
  assert.equal(request.body.max_completion_tokens, 1024);
  assert.equal('tools' in request.body, false);
  assert.equal('logprobs' in request.body, false);
});

test('provider HTTP errors do not leak keys or trigger unnecessary fallback calls', async () => {
  const statuses = [[400, 'invalid_request'], [401, 'invalid_credentials'], [403, 'invalid_credentials'],
    [404, 'model_unavailable'], [429, 'rate_limited'], [503, 'temporarily_unavailable']];
  for (const [code, status] of statuses) {
    const fetchImpl = async () => ({ ok: false, status: code });
    assert.equal((await interpretWithGemini(`gemini-${code}`, { key: 'test', fetchImpl })).status, status);
    assert.equal((await interpretWithGroq(`groq-${code}`, { key: 'test', fetchImpl })).status, status);
    assert.equal((await evaluateCohereRerank('hoa', [rose], { key: 'test', fetchImpl })).status, status);
  }
  let groqCalls = 0;
  for (const status of ['unconfigured', 'invalid_credentials', 'model_unavailable', 'invalid_request']) {
    const result = await interpretWithProviders('test', {
      gemini: async () => ({ status, intent: null }),
      groq: async () => { groqCalls++; return { status: 'enabled', intent: fallbackIntent('Cảm ơn') }; },
    });
    assert.equal(result.status, status);
    assert.equal(result.intent, null);
  }
  assert.equal(groqCalls, 0);
});

test('provider diagnostics redact keys, user input and generated failure output', async () => {
  const key = 'gsk_sensitive_test_key_1234567890';
  const input = 'private user request';
  const diagnostic = await safeProviderError({ json: async () => ({ error: {
    type: 'invalid_request_error', code: 'json_validate_failed',
    message: `schema failed while processing ${input}`,
    failed_generation: JSON.stringify({ request: input, secret: key }),
  } }) }, { key, input });
  const serialized = JSON.stringify(diagnostic);
  assert.equal(diagnostic.errorDetail, 'schema_validation_failed');
  assert.equal(serialized.includes(key), false);
  assert.equal(serialized.includes(input), false);
  assert.equal(serialized.includes(JSON.stringify({ request: input, secret: key })), false);
});

test('rerank timeout and malformed indices never replace local ranking', async () => {
  const shortlist = rankProducts([rose, sunflower], { query: 'Cảm ơn mẹ' });
  const timeout = await evaluateCohereRerank('Cảm ơn mẹ', shortlist, { key: 'test', fetchImpl: async () => { throw new Error('timeout'); } });
  assert.equal(timeout.status, 'temporarily_unavailable');
  assert.equal(timeout.items, null);
  const malformed = await evaluateCohereRerank('Cảm ơn mẹ', shortlist, { key: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ results: [{ index: 0 }, { index: 0 }] }) }) });
  assert.equal(malformed.status, 'invalid_response');
  assert.equal(shortlist.length, 2);
  assert.deepEqual(await evaluateCohereRerank('test', [], { key: 'test' }), { status: 'empty', items: [] });
});

test('blue preference changes Worlds ranking without overriding explicit color', async () => {
  const blue = { ...rose, id: 'blue', name: 'Bó cẩm tú cầu xanh ngọc', flower_species: ['cẩm tú cầu'] };
  const yellow = { ...sunflower, id: 'yellow', name: 'Bó hướng dương vàng', flower_species: ['hướng dương'] };
  const lily = { ...rose, id: 'lily', name: 'Bó hoa ly trắng', flower_species: ['ly'] };
  const red = { ...rose, id: 'red', name: 'Bó hoa hồng đỏ chúc mừng', flower_species: ['hồng'] };
  const products = [yellow, lily, blue, red];
  const makeRepo = (consent) => ({ ...repo(products),
    preference: async () => ({ consent, favorite_colors: ['blue'], favorite_themes: [] }),
  });
  const interpret = async (input) => ({ status: 'enabled', intent: {
    ...fallbackIntent(input), intent: 'celebration', themeKey: 'sunrise',
    semanticTags: ['celebration', 'encouragement'], preferredColors: ['yellow'],
  } });
  const plain = await new DiscoveryService({ repo: makeRepo(false), interpret }).world('Chúc mừng bạn tốt nghiệp thật rực rỡ', 'user');
  const personal = await new DiscoveryService({ repo: makeRepo(true), interpret }).world('Chúc mừng bạn tốt nghiệp thật rực rỡ', 'user');
  assert.ok(!plain.items.some((item) => item.id === blue.id));
  assert.equal(plain.items[0].id, yellow.id);
  assert.equal(personal.items[0].id, blue.id);
  assert.ok(personal.items.some((item) => item.id === blue.id));
  assert.ok(personal.items.some((item) => item.id === yellow.id));
  const explicit = await new DiscoveryService({ repo: makeRepo(true), interpret }).world('Chúc mừng tốt nghiệp, tôi muốn hoa màu vàng', 'user');
  assert.ok(explicit.items.every((item) => item.id !== blue.id));
  const explicitRed = await new DiscoveryService({ repo: makeRepo(true), interpret }).world('Chúc mừng tốt nghiệp, tôi muốn hoa màu đỏ', 'user');
  assert.ok(explicitRed.items.length > 0);
  assert.ok(explicitRed.items.every((item) => item.id === red.id));
});

test('Discover uses consented blue preference and ignores saved occasions after revocation', async () => {
  const blue = { ...rose, id: 'blue', name: 'Hoa diên vĩ xanh dương', flower_species: ['diên vĩ'] };
  const makeRepo = (consent, withOccasion = true) => ({ ...repo([rose, blue]),
    preference: async () => ({ consent, favorite_colors: ['blue'], favorite_themes: [] }),
    occasions: async () => withOccasion ? [{ title: 'Sinh nhật mẹ', kind: 'birthday', month: 11, day: 18, reminder_days: 7, enabled: true }] : [],
  });
  const now = () => new Date('2026-11-16T02:00:00Z');
  const yes = await new DiscoveryService({ repo: makeRepo(true, false), now }).rails('user');
  const no = await new DiscoveryService({ repo: makeRepo(false), now }).rails('user');
  assert.equal(yes.rails[0].key, 'holiday');
  assert.ok(yes.rails[0].items.every((item) => describeProduct(item).tags.includes('gratitude')));
  const colorRail = yes.rails.find((rail) => rail.key === 'for_you');
  assert.ok(colorRail);
  assert.ok(colorRail.items.length > 0);
  assert.ok(colorRail.items.every((item) => describeProduct(item).colors.includes('blue')));
  assert.equal(no.personalized, false);
  assert.equal(no.context.occasions.length, 0);
  assert.ok(!no.rails.some((rail) => rail.key === 'for_you' || rail.key === 'occasion'));
});
