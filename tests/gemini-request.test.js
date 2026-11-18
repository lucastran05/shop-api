import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWithRetry } from '../src/services/gemini-request.js';
import { converseAboutFlowers } from '../src/services/flower-conversation.js';

test('retries transient failures with a fresh signal and returns Gemini response', async () => {
  const signals = [];
  const result = await generateWithRetry({ models: { generateContent: async request => {
    signals.push(request.config.abortSignal);
    if (signals.length === 1) throw Object.assign(new Error('busy'), { status: 503 });
    return { text: 'answer' };
  } } }, { contents: 'question' });
  assert.equal(result.text, 'answer');
  assert.equal(signals.length, 2);
  assert.notEqual(signals[0], signals[1]);
});

test('permanent authentication failures are not retried', async () => {
  let calls = 0;
  await assert.rejects(generateWithRetry({ models: { generateContent: async () => {
    calls++; throw Object.assign(new Error('unauthorized'), { status: 401 });
  } } }, {}));
  assert.equal(calls, 1);
});

test('exhausted retries never leak provider errors or invented answers', async () => {
  const result = await converseAboutFlowers({ message: 'Explain an unknown topic' }, {
    general: true,
    client: { models: { generateContent: async () => { throw new Error('SECRET provider timeout'); } } },
  });
  assert.doesNotMatch(result.answer, /SECRET|timeout|API|gián đoạn|kết nối|lỗi/i);
  assert.match(result.answer, /chưa có câu trả lời đủ chắc chắn/);
});
