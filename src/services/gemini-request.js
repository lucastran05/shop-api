// Retry transient provider failures with a fresh per-attempt deadline.
// Credentials and provider errors stay on the server.
export async function generateWithRetry(ai, request, timeoutMs = 12000) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await ai.models.generateContent({ ...request,
        model: attempt > 0 ? (process.env.GEMINI_FALLBACK_MODEL || request.model) : request.model,
        config: {
        ...request.config,
        httpOptions: { ...request.config?.httpOptions, timeout: timeoutMs },
        abortSignal: AbortSignal.timeout(timeoutMs),
      } });
      if (!result.text?.trim()) throw new Error('Empty model response');
      return result;
    } catch (error) {
      const status = Number(error?.status);
      if (attempt === 1 || (status >= 400 && status < 500 && ![408, 429].includes(status))) throw error;
    }
  }
}
