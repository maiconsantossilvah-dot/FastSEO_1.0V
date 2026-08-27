import { PipelineUI } from '../components/PipelineUI.js';
import { Quota } from './quota.js';
import { addTokenCall } from './tokenUsage.js';
import { renderProviderEvent } from './aiRuntimeEvents.js';

/**
 * Traduz eventos neutros do orquestrador para a interface e serviços locais.
 * Manter esta ponte separada impede que o núcleo do pipeline conheça o DOM.
 */
export function createPipelineEventHandler({ tokenUsage, regenerationUsage = null }) {
  return event => {
    if (event.type === 'provider-event') {
      renderProviderEvent(event.stage, event.event);
      return;
    }

    if (event.type === 'usage') {
      const usageMode = event.mode === 'regeneration' ? 'regeneration' : 'pipeline';
      addTokenCall(tokenUsage, event.stage, event.usage, usageMode);
      if (regenerationUsage) addTokenCall(regenerationUsage, event.stage, event.usage, 'regeneration');
      PipelineUI.updateTokenUsage(tokenUsage);
      return;
    }

    if (event.type === 'agent-call-complete') {
      Quota.add(1);
      return;
    }

    if (event.type === 'stage-start') {
      PipelineUI.setStep(event.stage, 'active');
      if (event.stage === 1) PipelineUI.log(`[A1] Formatando ficha${event.bivolt ? ' bivolt' : ''}...`, 'i');
      if (event.stage === 2) PipelineUI.log('[A2] Conferindo dados...', 'i');
      if (event.stage === 3) PipelineUI.log(
        event.mode === 'regeneration' ? '[A3] Regenerando conteúdo comercial...' : '[A3] Gerando conteúdo comercial...',
        'i',
      );
      return;
    }

    if (event.type === 'stage-complete') {
      if (event.stage === 1) {
        PipelineUI.setStep(1, 'done');
        PipelineUI.log('[A1] Ficha formatada.', 'o');
      }
      if (event.stage === 2) {
        const rejected = event.qa?.status === 'REPROVADO';
        PipelineUI.setStep(2, rejected ? 'error' : 'done');
        PipelineUI.log(`[A2] ${event.qa?.status} - confiança ${event.qa?.confianca}`, rejected ? 'w' : 'o');
      }
      if (event.stage === 3) {
        PipelineUI.setStep(3, 'done');
        PipelineUI.log(event.mode === 'regeneration' ? '[A3] Conteúdo regenerado.' : '[A3] Conteúdo gerado.', 'o');
      }
      return;
    }

    if (event.type === 'stage-skipped') {
      PipelineUI.setStep(3, 'skip');
      PipelineUI.log(
        event.reason === 'rejected'
          ? '[A3] Pulado.'
          : '[A3] Opcional - use Gerar conteúdo comercial quando precisar.',
        'w',
      );
    }
  };
}
