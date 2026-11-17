const redact = (value, secrets = []) => {
  let text = String(value || '').replace(/[\r\n\t]+/g, ' ').trim();
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join('[redacted]');
  }
  return text
    .replace(/\b(?:Bearer\s+)?(?:gsk_|AIza)[A-Za-z0-9_-]{12,}/gi, '[redacted]')
    .replace(/(authorization|api[_ -]?key)\s*[:=]\s*[^,; ]+/gi, '$1=[redacted]')
    .slice(0, 480);
};

export async function safeProviderError(response, { key, input } = {}) {
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  const error = payload?.error && typeof payload.error === 'object' ? payload.error : {};
  const safeCode = typeof error.code === 'string' || typeof error.code === 'number'
    ? redact(error.code, [key, input]).replace(/[^\w.-]/g, '').slice(0, 80) || null : null;
  const safeType = typeof error.type === 'string'
    ? redact(error.type, [key, input]).replace(/[^\w.-]/g, '').slice(0, 80) || null : null;
  const message = redact(error.message || error.status || '', [key, input]) || null;
  const errorFields = Object.keys(error).filter((field) => /^[a-z_]{1,40}$/i.test(field)).slice(0, 12);
  // Never surface failed_generation: it contains model output and can echo request data.
  const errorDetail = safeCode === 'json_validate_failed' ? 'schema_validation_failed' : null;
  return { errorCode: safeCode, errorType: safeType, errorMessage: message, errorDetail, errorFields };
}

export function classifyTransportError(error) {
  const code = error?.cause?.code || error?.code || '';
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || code === 'ETIMEDOUT') return 'timeout';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns';
  if (/^(CERT_|TLS|ERR_TLS)/.test(code)) return 'tls';
  return 'network';
}
