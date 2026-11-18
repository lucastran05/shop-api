import { interpretWithGemini } from './gemini.js';
import { interpretWithGroq } from './groq.js';
import { validateIntent } from './intent.js';

export async function interpretWithProviders(input, {
  gemini = interpretWithGemini, groq = interpretWithGroq,
} = {}) {
  let primary;
  try { primary = await gemini(input); } catch { primary = { status: 'unavailable', intent: null }; }
  if (primary?.intent) {
    try { return { ...primary, intent: validateIntent(primary.intent), provider: 'gemini' }; }
    catch { primary = { status: 'unavailable', intent: null }; }
  }
  // Never retry credentials, model/configuration, or malformed-request failures via another call.
  // Groq is reserved for transient provider/network failures and quota responses.
  if (!['unavailable', 'temporarily_unavailable', 'rate_limited', 'invalid_response'].includes(primary?.status)) {
    return { status: primary?.status || 'unavailable', intent: null, provider: null };
  }
  let secondary;
  try { secondary = await groq(input); } catch { secondary = { status: 'unavailable', intent: null }; }
  if (secondary?.intent) {
    try { return { ...secondary, intent: validateIntent(secondary.intent), provider: 'groq' }; }
    catch { secondary = { status: 'unavailable', intent: null }; }
  }
  return { status: primary?.status || 'unavailable', intent: null, provider: null,
    diagnostic: secondary?.diagnostic || primary?.diagnostic || null };
}
