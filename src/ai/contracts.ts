export type ProviderName = 'gemini' | 'mistral' | 'groq';

export type ProviderErrorCode =
  | 'rate-limit'
  | 'daily-quota'
  | 'overloaded'
  | 'invalid-key'
  | 'invalid-response'
  | 'aborted'
  | 'unknown';

export interface ProviderError extends Error {
  code: ProviderErrorCode;
  provider: ProviderName;
  retryable: boolean;
  fallbackEligible: boolean;
  /** Indica indisponibilidade que não pode ser contornada rotacionando chaves. */
  providerWide?: boolean;
}

export interface ProviderRequest {
  system: string;
  userMessage: string;
  maxTokens: number;
  jsonMode?: boolean;
  /** Modelo resolvido para o agente e provedor desta tentativa. */
  model?: string;
}

export interface TokenUsage {
  provider: ProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  totalTokens: number;
}

export interface ProviderResult {
  text: string;
  usage: TokenUsage;
}

export type ProviderEvent =
  | { type: 'queued'; provider: ProviderName; waitMs: number }
  | { type: 'retry'; provider: ProviderName; attempt: number; waitMs: number }
  | { type: 'rate-limit'; provider: ProviderName }
  // Índices de chave são baseados em 1 para corresponder ao feedback exibido à equipe.
  | { type: 'key-rotation'; provider: ProviderName; fromKeyIndex: number; toKeyIndex: number; reason: ProviderErrorCode }
  | { type: 'provider-fallback'; from: ProviderName; to: ProviderName; reason: ProviderErrorCode }
  | { type: 'usage'; usage: TokenUsage };

export interface RuntimeClock {
  now(): number;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}

export interface ProviderContext {
  provider: ProviderName;
  signal: AbortSignal;
  emit(event: ProviderEvent): void;
  // Reservado para compatibilidade do contrato. O chamador deve aguardar antes
  // de enfileirar; o scheduler não ordena nem bloqueia a fila por este campo.
  notBefore?: number;
}

export interface AiProvider {
  generate(request: ProviderRequest, context: ProviderContext): Promise<ProviderResult>;
}

export interface ProviderScheduler {
  schedule<T>(task: () => Promise<T>, context: ProviderContext): Promise<T>;
}
