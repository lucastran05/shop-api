// Explicit administrator diagnostic. Prints statuses only, never credentials.
import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { interpretWithGemini } from './gemini.js';
import { interpretWithGroq } from './groq.js';

const configured = (name) => Boolean(process.env[name]?.trim());
const models = {
  gemini: process.env.DISCOVERY_GEMINI_MODEL || 'gemini-3.5-flash-lite',
  groq: process.env.DISCOVERY_GROQ_MODEL || 'openai/gpt-oss-20b',
  cohere: process.env.DISCOVERY_COHERE_MODEL || 'rerank-v5.0-fast',
};
const status = {
  gemini: { key: configured('GEMINI_API_KEY') ? 'CONFIGURED' : 'MISSING', model: models.gemini },
  groq: { key: configured('GROQ_API_KEY') ? 'CONFIGURED' : 'MISSING', model: models.groq },
  cohere: { key: configured('COHERE_API_KEY') ? 'CONFIGURED' : 'MISSING', model: models.cohere,
    liveTraffic: false, evaluationEnabled: process.env.DISCOVERY_EVALUATE_COHERE === '1' },
};
const input = 'Một lời cảm ơn nhẹ nhàng dành cho mẹ.';
const run = async (name, adapter) => {
  const start = performance.now();
  const result = await adapter(input);
  status[name].live = { status: result.status, validatedIntent: Boolean(result.intent),
    latencyMs: Math.round(performance.now() - start) };
};
if (process.argv.includes('--live-gemini') && configured('GEMINI_API_KEY')) await run('gemini', interpretWithGemini);
if (process.argv.includes('--live-groq') && configured('GROQ_API_KEY')) await run('groq', interpretWithGroq);
console.log(JSON.stringify(status));
