import { PipelineUI } from '../components/PipelineUI.js';

const providerLabel = provider => provider === 'mistral' ? 'Mistral' : 'Gemini';

/**
 * Única ponte entre eventos neutros do runtime e a apresentação do pipeline.
 * @param {number} agentNum
 * @param {import('../ai/contracts.js').ProviderEvent} event
 */
export function renderProviderEvent(agentNum, event) {
  if (event.type === 'usage') {
    if (agentNum > 0) PipelineUI.setStepApi(agentNum, providerLabel(event.usage.provider));
    return;
  }

  if (event.type === 'queued') {
    PipelineUI.log(`Fila ${event.provider}: aguardando ${Math.ceil(event.waitMs / 1000)}s para respeitar o limite por minuto.`, 'i');
    return;
  }

  if (event.type === 'retry') {
    PipelineUI.log(`Limite temporário (${event.provider}). Tentativa ${event.attempt} em ${Math.ceil(event.waitMs / 1000)}s...`, 'w');
    return;
  }

  if (event.type === 'rate-limit') {
    PipelineUI.log(`Limite por minuto detectado (${event.provider}).`, 'w');
    return;
  }

  if (event.type === 'key-rotation') {
    PipelineUI.log(
      `${providerLabel(event.provider)} chave ${event.fromKeyIndex} indisponível. Tentando chave ${event.toKeyIndex}...`,
      'w',
    );
    return;
  }

  if (event.type === 'provider-fallback') {
    PipelineUI.log(
      `${providerLabel(event.from)} indisponível. Usando ${providerLabel(event.to)} como fallback...`,
      'w',
    );
  }
}

export function createProviderEventHandler(agentNum) {
  return event => renderProviderEvent(agentNum, event);
}
