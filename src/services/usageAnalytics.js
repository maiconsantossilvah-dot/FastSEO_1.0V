import { UserAccess } from './userAccess.js';

const QUEUE_KEY = 'fastseo_usage_queue_v1';
const MAX_QUEUE_SIZE = 100;
const PERMANENT_FAILURES = new Set([400, 403, 409, 422]);
let flushing = null;
let initialized = false;

function readQueue() {
  try {
    const value = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(value) ? value.slice(-MAX_QUEUE_SIZE) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE))); }
  catch { /* Telemetria nunca deve interromper o pipeline. */ }
}

function eventId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const random = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}_${random}_${random}`.slice(0, 80);
}

function safeInteger(value, max = 100_000_000) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(0, Math.round(number))) : 0;
}

function normalizeCalls(calls) {
  return (Array.isArray(calls) ? calls : [])
    .filter(call => ['gemini', 'mistral', 'groq'].includes(String(call?.provider || '').toLowerCase()))
    .map(call => ({
      stage: Math.min(3, Math.max(1, safeInteger(call.stage, 3) || 1)),
      provider: String(call.provider).toLowerCase(),
      model: String(call.model || 'desconhecido').slice(0, 120),
      kind: call.kind === 'regeneration' ? 'regeneration' : 'generation',
      inputTokens: safeInteger(call.inputTokens),
      outputTokens: safeInteger(call.outputTokens),
      thinkingTokens: safeInteger(call.thinkingTokens),
      cachedTokens: safeInteger(call.cachedTokens),
      totalTokens: safeInteger(call.totalTokens),
    }))
    .filter(call => call.totalTokens > 0)
    .slice(0, 8);
}

async function flushQueue() {
  let queue = readQueue();
  while (queue.length) {
    const payload = queue[0];
    try {
      await UserAccess.request('/usage-events', {
        method: 'POST',
        body: JSON.stringify(payload),
        keepalive: true,
      });
      queue = readQueue().filter(item => item?.eventId !== payload.eventId);
      writeQueue(queue);
    } catch (error) {
      if (PERMANENT_FAILURES.has(Number(error?.status))) {
        queue = readQueue().filter(item => item?.eventId !== payload.eventId);
        writeQueue(queue);
        continue;
      }
      break;
    }
  }
}

export const UsageAnalytics = {
  initialize() {
    if (!initialized) {
      initialized = true;
      window.addEventListener('online', () => this.flush());
    }
    this.flush();
  },

  record({ status, durationMs, category = '', bivolt = false, calls = [] }) {
    const normalizedCalls = normalizeCalls(calls);
    if (!normalizedCalls.length) return false;

    const queue = readQueue();
    queue.push({
      eventId: eventId(),
      status: ['aprovado', 'reprovado', 'erro'].includes(status) ? status : 'erro',
      durationMs: safeInteger(durationMs, 3_600_000),
      category: String(category || '').trim().slice(0, 120),
      bivolt: Boolean(bivolt),
      calls: normalizedCalls,
    });
    writeQueue(queue);
    this.flush();
    return true;
  },

  flush() {
    if (!UserAccess.current().user || flushing) return flushing;
    flushing = flushQueue().finally(() => { flushing = null; });
    return flushing;
  },

  getAnalytics({ from, to }) {
    const query = new URLSearchParams({ from, to });
    return UserAccess.request(`/usage-analytics?${query}`, { retryOnWake: true });
  },
};
