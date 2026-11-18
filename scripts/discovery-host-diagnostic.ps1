$ErrorActionPreference = 'Stop'
$composeFile = Join-Path $PSScriptRoot '..\..\compose.yaml'
$nodeScript = @'
import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import repository from './src/modules/discovery/repository.js';
import { interpretWithGemini } from './src/modules/discovery/gemini.js';
import { interpretWithGroq } from './src/modules/discovery/groq.js';
import { interpretWithProviders } from './src/modules/discovery/providers.js';
import { evaluateCohereRerank } from './src/modules/discovery/rerank.js';
import { rankProducts } from './src/modules/discovery/ranking.js';
import { DiscoveryService } from './src/modules/discovery/service.js';

const models = {
  gemini: process.env.DISCOVERY_GEMINI_MODEL || 'gemini-3.5-flash-lite',
  groq: process.env.DISCOVERY_GROQ_MODEL || 'openai/gpt-oss-20b',
  cohere: process.env.DISCOVERY_COHERE_MODEL || 'rerank-v5.0-fast',
};
const keyNames = { gemini: 'GEMINI_API_KEY', groq: 'GROQ_API_KEY', cohere: 'COHERE_API_KEY' };
const configured = (name) => Boolean(process.env[keyNames[name]]?.trim());
const query = 'Chúc mừng bạn tốt nghiệp thật rực rỡ.';
const rows = {};

async function liveIntent(name, adapter) {
  if (!configured(name)) return { provider: name, model: models[name], keyStatus: 'MISSING', resultStatus: 'unconfigured',
    liveTest: 'SKIPPED', httpStatus: null, validation: 'not_run', latencyMs: 0 };
  let httpStatus = null;
  const started = performance.now();
  let result;
  try {
    result = await adapter(query, { fetchImpl: async (...args) => {
      const response = await fetch(...args);
      httpStatus = response.status;
      return response;
    } });
  } catch {
    result = { status: 'temporarily_unavailable', intent: null, diagnostic: { errorType: 'adapter_exception' } };
  }
  const validation = Boolean(result.intent);
  return { provider: name, model: models[name], keyStatus: 'CONFIGURED', resultStatus: result.status,
    liveTest: validation ? 'PASS' : 'FAIL', httpStatus: result.diagnostic?.httpStatus ?? httpStatus,
    errorType: result.diagnostic?.errorType || null, errorCode: result.diagnostic?.errorCode || null,
    errorMessage: result.diagnostic?.errorMessage || null, errorDetail: result.diagnostic?.errorDetail || null,
    errorFields: result.diagnostic?.errorFields || null,
    validation: validation ? 'passed' : result.status === 'unconfigured' ? 'not_run' : 'failed',
    latencyMs: Math.round(performance.now() - started), intentProvider: validation ? name : null,
    _intent: result.intent, _result: result };
}

try {
  let routedIntent = null;
  const startRouting = performance.now();
  const routed = await interpretWithProviders(query, {
    gemini: async (input) => {
      rows.gemini = await liveIntent('gemini', interpretWithGemini);
      return rows.gemini._result;
    },
    groq: async (input) => {
      rows.groq = await liveIntent('groq', interpretWithGroq);
      return rows.groq._result;
    },
  });
  routedIntent = routed.intent;
  const routingMs = Math.round(performance.now() - startRouting);
  if (!rows.gemini) rows.gemini = await liveIntent('gemini', interpretWithGemini);
  if (!rows.groq) rows.groq = await liveIntent('groq', interpretWithGroq);

  let cohereRow;
  if (!configured('cohere')) {
    cohereRow = { provider: 'cohere', model: models.cohere, keyStatus: 'MISSING', resultStatus: 'unconfigured',
      liveTest: 'SKIPPED', httpStatus: null, validation: 'not_run', latencyMs: 0, candidates: 0 };
  } else {
    try {
      const products = await repository.products();
      const candidates = rankProducts(products, { query, limit: 5 });
      if (!candidates.length) {
        cohereRow = { provider: 'cohere', model: models.cohere, keyStatus: 'CONFIGURED', resultStatus: 'empty',
          liveTest: 'SKIPPED', skipReason: 'no_candidates', httpStatus: null, validation: 'not_run', latencyMs: 0,
          candidates: 0, internalTop: [] };
      } else {
        let httpStatus = null;
        const started = performance.now();
        const result = await evaluateCohereRerank(query, candidates, { fetchImpl: async (...args) => {
          const response = await fetch(...args);
          httpStatus = response.status;
          return response;
        } });
        cohereRow = { provider: 'cohere', model: models.cohere, keyStatus: 'CONFIGURED', resultStatus: result.status,
          liveTest: result.status === 'enabled' ? 'PASS' : 'FAIL', httpStatus: result.diagnostic?.httpStatus ?? httpStatus,
          errorType: result.diagnostic?.errorType || null, errorCode: result.diagnostic?.errorCode || null,
          errorMessage: result.diagnostic?.errorMessage || null, errorDetail: result.diagnostic?.errorDetail || null,
          errorFields: result.diagnostic?.errorFields || null,
          validation: result.status === 'enabled' ? 'passed' : 'failed', latencyMs: Math.round(performance.now() - started),
          candidates: candidates.length, internalTop: candidates.slice(0, 5).map(p => p.name),
          cohereTop: result.items?.slice(0, 5).map(p => p.name) || null };
      }
    } catch {
      cohereRow = { provider: 'cohere', model: models.cohere, keyStatus: 'CONFIGURED', resultStatus: 'diagnostic_error',
        liveTest: 'FAIL', errorType: 'catalog_or_adapter_error', httpStatus: null, validation: 'failed', latencyMs: 0, candidates: 0 };
    }
  }

  let worlds;
  try {
    const service = new DiscoveryService({ repo: repository, interpret: async () => routed });
    const result = await service.world(query, null);
    worlds = { status: 'PASS', mode: result.mode, aiStatus: result.aiStatus, provider: routed.provider || null,
      itemCount: result.items.length, topProducts: result.items.slice(0, 5).map(p => p.name), latencyMs: routingMs };
  } catch {
    worlds = { status: 'FAIL', mode: 'unknown', aiStatus: routed.status || 'unknown', provider: routed.provider || null };
  }

  const publicRow = ({ _intent, _result, ...row }) => row;
  console.log(JSON.stringify({ providers: [publicRow(rows.gemini), publicRow(rows.groq), cohereRow], worlds }));
} finally {
  await repository.db.end().catch(() => {});
}
'@

$nodeScript | docker compose -f $composeFile exec -T api node --input-type=module
if ($LASTEXITCODE -ne 0) { throw "Discovery provider diagnostic failed (exit $LASTEXITCODE)." }
