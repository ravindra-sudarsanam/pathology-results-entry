/** A random id for idempotency keys. crypto.randomUUID needs a secure context (https or localhost). */
export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
