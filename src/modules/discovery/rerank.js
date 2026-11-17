import { describeProduct } from './semantic-data.js';
import { classifyTransportError, safeProviderError } from './provider-diagnostics.js';

// Experimental, evaluation-only adapter. Never called by the live Discovery service.
export async function evaluateCohereRerank(query, candidates, {
  fetchImpl = fetch, key = process.env.COHERE_API_KEY,
} = {}) {
  if (!key) return { status: 'unconfigured', items: null };
  const model = process.env.DISCOVERY_COHERE_MODEL || 'rerank-v5.0-fast';
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) return { status: 'unavailable', items: null };
  if (!candidates.length) return { status: 'empty', items: [] };
  const shortlist = candidates.slice(0, 30);
  const documents = shortlist.map((product) => {
    const meta = describeProduct(product);
    return JSON.stringify({ name: product.name, category: product.category,
      species: product.flower_species, colors: meta.colors, themes: meta.tags });
  });
  let response;
  try {
    response = await fetchImpl('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, query, documents, top_n: shortlist.length }),
      signal: AbortSignal.timeout(3500),
    });
  } catch (error) {
    return { status: 'temporarily_unavailable', items: null,
      diagnostic: { errorType: classifyTransportError(error) } };
  }
  if (!response.ok) {
    const details = await safeProviderError(response, { key, input: query });
    const status = [401, 403].includes(response.status) ? 'invalid_credentials'
      : response.status === 404 ? 'model_unavailable'
      : response.status === 429 ? 'rate_limited'
      : response.status >= 500 || response.status === 498 ? 'temporarily_unavailable'
      : 'invalid_request';
    return { status, items: null, diagnostic: { httpStatus: response.status, ...details } };
  }
  let body;
  try { body = await response.json(); }
  catch { return { status: 'invalid_response', items: null, diagnostic: { errorType: 'invalid_json' } }; }
  const indices = body?.results?.map((result) => result.index);
  if (!Array.isArray(indices) || indices.length !== shortlist.length ||
    new Set(indices).size !== shortlist.length ||
    !indices.every((index) => Number.isInteger(index) && index >= 0 && index < shortlist.length)) {
    return { status: 'invalid_response', items: null, diagnostic: { errorType: 'invalid_rerank_indices' } };
  }
  return { status: 'enabled', items: indices.map((index) => shortlist[index]) };
}
