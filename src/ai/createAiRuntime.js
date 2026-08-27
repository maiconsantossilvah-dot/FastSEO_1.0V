import { AiGateway } from './AiGateway.js';
import { RateLimitScheduler } from './RateLimitScheduler.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { MistralProvider } from './providers/MistralProvider.js';

/**
 * Composition root isolado. Produção cria uma instância; cada teste cria a sua,
 * sem registro global mutável nem método de reset.
 * @param {{
 *  fetch: typeof globalThis.fetch,
 *  clock: import('./contracts.js').RuntimeClock,
 *  getGeminiKeys: () => string[],
 *  getMistralKeys: () => string[],
 *  getGeminiModel: () => string,
 *  mistralModel: string,
 *  validateGeminiKey: (key: string) => boolean,
 *  minDelayMs?: number
 * }} dependencies
 */
export function createAiRuntime(dependencies) {
  const minDelayMs = dependencies.minDelayMs ?? 4500;
  const schedulers = {
    gemini: new RateLimitScheduler({ minDelayMs, clock: dependencies.clock }),
    mistral: new RateLimitScheduler({ minDelayMs, clock: dependencies.clock }),
  };

  const providers = {
    gemini: new GeminiProvider({
      scheduler: schedulers.gemini,
      clock: dependencies.clock,
      fetch: dependencies.fetch,
      getKeys: dependencies.getGeminiKeys,
      getModel: dependencies.getGeminiModel,
      validateKey: dependencies.validateGeminiKey,
    }),
    mistral: new MistralProvider({
      scheduler: schedulers.mistral,
      clock: dependencies.clock,
      fetch: dependencies.fetch,
      getKeys: dependencies.getMistralKeys,
      model: dependencies.mistralModel,
    }),
  };

  return new AiGateway({ providers });
}
