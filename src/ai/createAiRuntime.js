import { AiGateway } from './AiGateway.js';
import { RateLimitScheduler } from './RateLimitScheduler.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { MistralProvider } from './providers/MistralProvider.js';
import { GroqProvider } from './providers/GroqProvider.js';

/**
 * Composition root isolado. Produção cria uma instância; cada teste cria a sua,
 * sem registro global mutável nem método de reset.
 * @param {{
 *  fetch: typeof globalThis.fetch,
 *  clock: import('./contracts.js').RuntimeClock,
 *  getGeminiKeys: () => string[],
 *  getMistralKeys: () => string[],
 *  getGroqKeys: () => string[],
 *  getGeminiModel: () => string,
 *  mistralModel: string,
 *  groqDefaultModel: string,
 *  getAgentRoute: (agentNum: number) => {provider: import('./contracts.js').ProviderName, models: Record<import('./contracts.js').ProviderName, string>},
 *  validateGeminiKey: (key: string) => boolean,
 *  minDelayMs?: number
 * }} dependencies
 */
export function createAiRuntime(dependencies) {
  const minDelayMs = dependencies.minDelayMs ?? 4500;
  const schedulers = {
    gemini: new RateLimitScheduler({ minDelayMs, clock: dependencies.clock }),
    mistral: new RateLimitScheduler({ minDelayMs, clock: dependencies.clock }),
    groq: new RateLimitScheduler({ minDelayMs, clock: dependencies.clock }),
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
    groq: new GroqProvider({
      scheduler: schedulers.groq,
      clock: dependencies.clock,
      fetch: dependencies.fetch,
      getKeys: dependencies.getGroqKeys || (() => []),
      defaultModel: dependencies.groqDefaultModel || 'openai/gpt-oss-120b',
    }),
  };

  return new AiGateway({ providers, getAgentRoute: dependencies.getAgentRoute });
}
