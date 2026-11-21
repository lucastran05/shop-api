import test from 'node:test';
import assert from 'node:assert/strict';
import { wantsCatalog, formatAnswer, converseAboutFlowers } from '../src/services/flower-conversation.js';
import { adviseFlowers } from '../src/services/flower-advisor.js';

test('meaning follow-up uses previous assistant flowers without retrieving or repeating inventory', async () => {
  const history = [{ role: 'assistant', text: 'Bó cẩm chướng Yêu Thương; Giỏ cẩm chướng Tri Ân; Bó lily hồng Kiêu Sa.' }];
  for (const message of ['Ý nghĩa của từng loài hoa vừa nêu', 'Tại sao lại chọn những hoa đó?']) {
    const result = await adviseFlowers({ message, history }, {
      db: { query: () => assert.fail('meaning must not retrieve shopping suggestions') },
      client: { models: { generateContent: async request => {
        assert.match(request.config.systemInstruction, /CHẾ ĐỘ GIẢI THÍCH/);
        assert.deepEqual(JSON.parse(request.contents).history, history);
        return { text: JSON.stringify({ answer: '• Cẩm chướng hồng thường gắn với lòng biết ơn.\n• Lily hồng thường gợi sự ngưỡng mộ.' }) };
      } } },
    });
    assert.match(result.answer, /biết ơn/);
    assert.doesNotMatch(result.answer, /Giá:|Còn \d|Nguồn hệ thống/);
    assert.deepEqual(result.sources, []);
  }
});

test('meaning outage does not turn into a shopping list', async () => {
  const result = await adviseFlowers({ message: 'Ý nghĩa hoa cho 20/11?' }, {
    db: { query: () => assert.fail('unexpected query') },
    client: { models: { generateContent: async () => { throw new Error('timeout'); } } },
  });
  assert.equal(result.mode, 'advice_fallback');
  assert.doesNotMatch(result.answer, /Giá:|Cẩm chướng|danh mục/);
});

test('inventory question reads live catalog and quotes the available variant', async () => {
  let queried = false;
  const result = await adviseFlowers({ message: 'Shop còn mẫu hoa nào tặng thầy cô 20/11?', history: [] }, {
    db: { query: async sql => {
      queried = true;
      assert.match(sql, /active=TRUE/);
      assert.match(sql, /hidden/);
      return { rows: [{ id: 'p1', name: 'Bó cẩm chướng', price: 100000, stock: 5,
        variants: [{ label: 'Nhỏ', price: 100000, stock_quantity: 0 }, { label: 'Lớn', price: 250000, stock_quantity: 5 }],
        attributes: [] }] };
    } },
    client: { models: { generateContent: async request => {
      const { products } = JSON.parse(request.contents);
      assert.equal(products[0].price, 250000);
      assert.equal(products[0].stock, 5);
      return { text: JSON.stringify({ productIds: ['p1'], knowledgeIds: [], maxBudget: 0, month: 0, season: '', followUp: 'none' }) };
    } } },
  });
  assert.ok(queried);
  assert.match(result.answer, /250\.000 đ/);
  assert.match(result.answer, /Còn 5/);
  assert.equal(result.sources[0].url, '/products/p1');
});

test('provider outage reports sold-out flowers without recommending unrelated inventory', async () => {
  const result = await adviseFlowers({ message: 'Shop có hoa cẩm chướng không?' }, {
    db: { query: async () => ({ rows: [
      { id: 'p1', name: 'Hoa cẩm chướng', price: 100000, stock: 0, attributes: [] },
      { id: 'p2', name: 'Hoa hướng dương', price: 200000, stock: 8, attributes: [] },
    ] }) },
    client: { models: { generateContent: async () => { throw new Error('timeout'); } } },
  });
  assert.match(result.answer, /hết hàng/);
  assert.doesNotMatch(result.answer, /hướng dương/);
  assert.equal(result.sources.length, 0);
});

const question = 'tôi cần tìm hoa để tặng cho thầy cô nhân dịp 20/11, bên shop có thể gợi ý nên dùng những loại hoa như nào ko';
test('inline bullets become separate lines and ordinary prose stays intact', () => {
  assert.equal(formatAnswer('Gợi ý: • Hướng dương • Cẩm chướng'), 'Gợi ý:\n• Hướng dương\n• Cẩm chướng');
  assert.equal(formatAnswer('2 + 2 = 4.'), '2 + 2 = 4.');
});
test('general conversation preserves assistant context and answers non-flower questions', async () => {
  const history = [{ role: 'assistant', text: 'Bạn có thể tính 2 + 2.' }];
  const result = await converseAboutFlowers({ message: 'Kết quả là gì?', history }, {
    general: true,
    client: { models: { generateContent: async (request) => {
      assert.deepEqual(JSON.parse(request.contents).history, history);
      assert.match(request.config.systemInstruction, /Trả lời cả chủ đề ngoài hoa/);
      return { text: JSON.stringify({ answer: '2 + 2 = 4.' }) };
    } } },
  });
  assert.equal(result.mode, 'general_conversation');
  assert.equal(result.answer, '2 + 2 = 4.');
});
test('general advice is separate from explicit shop inventory/price requests', () => {
  for (const message of [question,'Gợi ý hoa sinh nhật mẹ dưới 300k','Hoa anh đào khác hoa mận như thế nào?','Chỉ tư vấn loại hoa, không liệt kê sản phẩm']) {
    assert.equal(wantsCatalog({message}),false,message);
  }
  for (const message of ['Shop có hoa nào dưới 300k?','Cho xem các sản phẩm hoa 20/11','Giá bó cẩm chướng bao nhiêu?']) assert.equal(wantsCatalog({message}),true,message);
});
