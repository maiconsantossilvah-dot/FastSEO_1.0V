/**
 * modules/pipeline.js
 * -----------------------------------------------------------------------------
 * Controla o fluxo de 3 agentes:
 *   1. Formatador (A1 -> Mistral)
 *   2. Conferente/QA (A2 -> Gemini)
 *   3. Copywriter (A3 -> Gemini)
 *
 * Este arquivo é o adaptador da aplicação: valida entrada, resolve categoria,
 * projeta eventos na UI e persiste o resultado. A sequência A1/A2/A3 e as regras
 * puras ficam em pipelineOrchestrator.js e pipelineDomain.js.
 */

import { callAgent } from '../services/api.js';
import { Prompts } from './prompts.js';
import { Categories } from './categories.js';
import { Quota } from './quota.js';
import { History } from './history.js';
import { Logs } from './quota.js';
import { Utils } from '../utils/index.js';
import { PipelineUI } from '../components/PipelineUI.js';
import { AppState } from './state.js';
import { parseQAJson, formatQAReport, mergeQAFindings } from './qa.js?v=20260824-compact';
import { getCategoryNotice } from './categoryNotices.js';
import { buildCategoryQaSchemaPrompt, hasCategoryDefinition, textToFieldList } from './categoryQaSchema.js';
import { isValidGeminiKey } from '../utils/apiKeys.js';
import { createTokenUsage } from './tokenUsage.js';
import { stabilizeFichaOutput, validateFichaOutput } from './outputGuards.js';
import { UsageAnalytics } from '../services/usageAnalytics.js';
import { prepareProductInput } from '../utils/prepareProductInput.js';
import { ApiSettings } from '../services/apiSettings.js';
import { buildPipelinePrompts, resolveTitleRule } from './pipelineDomain.js';
import { runCopywriterAgent, runPipelineAgents } from './pipelineOrchestrator.js';
import { createPipelineEventHandler } from './pipelineUiAdapter.js';

// Integrações opcionais: SEO enriquece prompts; Analytics registra uso e erros.
import { buscarKeywords, montarContextoSEO, hasSerpApiKey } from '../services/serp.js';
import {
  trackPipelineIniciado,
  trackPipelineConcluido,
  trackPipelineErro,
  trackCotaAtingida,
  trackRegeneracao,
} from '../services/analytics.js';

// Helper: busca keywords SEO antes de chamar os agentes
// Retorna uma string de contexto para injetar nos prompts,
// ou '' se a chave SerpAPI não estiver configurada / ocorrer erro.
async function obterContextoSEO(inputUsuario, categoriaAtual) {
  if (!hasSerpApiKey()) return '';

  try {
    // Usa o nome da categoria como query; fallback: primeiras 60 caracteres do input.
    const query = categoriaAtual
      ? categoriaAtual
      : inputUsuario.trim().split('\n')[0].substring(0, 60);

    const resultado = await buscarKeywords(query);
    return montarContextoSEO(resultado);
  } catch {
    return ''; // Falha silenciosa: SEO não deve bloquear o pipeline principal.
  }
}

function shouldAutoRunCopywriter() {
  try { return localStorage.getItem('fastseo_auto_a3') !== '0'; }
  catch { return true; }
}

function orchestratorDependencies(emit) {
  return {
    callAgent,
    stabilizeFichaOutput,
    validateFichaOutput,
    parseQAJson,
    mergeQAFindings,
    formatQAReport,
    emit,
  };
}

export const Pipeline = {
  /**
   * Ponto de entrada público.
   * @param {boolean} forced - Ignora alertas de validação de input.
   */
  async run(forced = false) {
    const inputRaw = document.getElementById('inputText')?.value || '';
    if (!forced) {
      const alerts = Utils.validateInput(inputRaw.trim());
      if (alerts.length) { this._showInputAlerts(alerts); return; }
    }
    document.getElementById('inputAlertBox')?.remove();
    await this._execute(inputRaw);
  },

  // Reexecuta só o Agente 3 (Copywriter).
  // Reutiliza ficha e validação já geradas (AppState.pipeline.result),
  // sem chamar A1 (Formatador) nem A2 (Conferente).
  // Consome apenas 1 requisição de cota.
  async rerunCopywriter() {
    const { ficha, bivolt } = AppState.pipeline.result || {};
    const tokenUsage = createTokenUsage(AppState.pipeline.result?.tokenUsage);
    const regenerationUsage = createTokenUsage();
    const regenerationStartedAt = Date.now();

    // Fallback: lê do DOM caso o state tenha sido perdido (ex: reload parcial).
    const fichaText = ficha || document.getElementById('fichaOut')?.innerText?.trim() || '';

    if (!fichaText) {
      PipelineUI.log('Atenção: execute o pipeline completo antes de regenerar.', 'w');
      return;
    }

    const geminiKey = ApiSettings.getGeminiPrimary();
    const mistralKey = ApiSettings.getMistralPrimary();
    if (!isValidGeminiKey(geminiKey) && mistralKey.length <= 20) {
      PipelineUI.log('Configure Gemini ou Mistral para gerar o Conteúdo Comercial.', 'w');
      return;
    }

    // Verificação de cota
    const uso = Quota.getUsage(), lim = Quota.getLimit();
    if (uso.count + 1 > lim) {
      alert(`Cota diária esgotada (${uso.count}/${lim}). A cota renova à meia-noite.`);
      trackCotaAtingida(); // Analytics: registra cota atingida
      return;
    }

    // Analytics: registra intenção de regeneração.
    trackRegeneracao();

    // Abort controller próprio para não cancelar um pipeline completo em andamento.
    const abort = new AbortController();
    const signal = abort.signal;

    try {
      const input = document.getElementById('inputText')?.value || fichaText;
      const resolution = await Categories.resolveDetailed(input);
      const matched = resolution.categories;
      const fewShot = Utils.buildFewShot(bivolt, matched);
      const prompts = buildPipelinePrompts({
        getPrompt: key => Prompts.get(key),
        bivolt,
        fewShot,
        titleRule: resolveTitleRule(matched, resolution),
      });
      const emit = createPipelineEventHandler({ tokenUsage, regenerationUsage });
      const conteudo = await runCopywriterAgent({
        systemPrompt: prompts.agent3,
        ficha: fichaText,
        signal,
        mode: 'regeneration',
      }, { callAgent, emit });

      // Mantém o estado interno e a tela sincronizados após regenerar o conteúdo.
      AppState.pipeline.result.conteudo = conteudo;
      AppState.pipeline.result.tokenUsage = tokenUsage;
      const outEl = document.getElementById('conteudoOut');
      if (outEl) outEl.innerText = conteudo;
      PipelineUI.showResults(fichaText, AppState.pipeline.result.validacao || '', conteudo, bivolt, false, tokenUsage);

      // Garante que o bloco esteja visível.
      const copyBlock = document.getElementById('copyBlock');
      if (copyBlock) copyBlock.style.display = '';

      if (AppState.pipeline.result.historyId) {
        try {
          await History.updateResult(AppState.pipeline.result.historyId, { conteudo, tokenUsage });
        } catch (historyError) {
          PipelineUI.log(`Histórico não atualizado: ${historyError.message}`, 'w');
        }
      }

      UsageAnalytics.record({
        status: 'aprovado',
        durationMs: Date.now() - regenerationStartedAt,
        category: AppState.pipeline.result.category || '',
        bivolt: Boolean(bivolt),
        calls: regenerationUsage.calls,
      });

      Quota.updateUI();

    } catch (err) {
      if (err.name === 'AbortError') return;
      PipelineUI.setStep(3, 'error');
      PipelineUI.log(`[A3] ERRO ao regenerar: ${err.message}`, 'e');
      alert(`Erro ao regenerar:\n${err.message}`);
    }
  },

  // Execução principal do pipeline completo.
  async _execute(inputRaw) {
    const t0 = Date.now();

    const geminiKey = ApiSettings.getGeminiPrimary();
    const mistralKey = ApiSettings.getMistralPrimary();
    const anyKeyOk = isValidGeminiKey(geminiKey)
      || mistralKey.length > 20;

    if (!anyKeyOk) { alert('Configure pelo menos uma API Key (Gemini ou Mistral) antes de continuar.'); return; }
    if (!inputRaw.trim()) { alert('Cole os dados do produto antes de processar.'); return; }

    // Aborta execução anterior, se houver.
    if (AppState.pipeline.abort) AppState.pipeline.abort.abort();
    AppState.pipeline.abort = new AbortController();
    const signal = AppState.pipeline.abort.signal;

    // Verificação de cota
    const uso = Quota.getUsage(), lim = Quota.getLimit();
    const autoA3 = shouldAutoRunCopywriter();
    const chamadasPrevistas = autoA3 ? 3 : 2;
    if (uso.count + 2 > lim) {
      alert(`Cota diária esgotada (${uso.count}/${lim}). A cota renova à meia-noite.`);
      trackCotaAtingida(); // Analytics: registra cota atingida
      return;
    }
    if (uso.count + chamadasPrevistas > lim) {
      PipelineUI.log(`Cota baixa (${uso.count}/${lim}) - o conteúdo comercial pode precisar ser gerado depois.`, 'w');
    }

    // Metadados para Analytics.
    const modeloAtual = ApiSettings.getModel();
    const mistralOk = mistralKey.length > 20;
    const categoriaAtual = Categories.find(AppState.categories.active)?.nome || '';
    const telemetryContext = { category: categoriaAtual, bivolt: false };
    let telemetryRecorded = false;

    // Analytics: pipeline iniciado.
    trackPipelineIniciado({
      modelo: modeloAtual,
      temPDF: !!AppState.pdfTexto,
      temSEO: hasSerpApiKey(),
      categoria: categoriaAtual,
    });

    PipelineUI.clearResults();
    AppState.pipeline.result = {};
    PipelineUI.resetSteps();
    PipelineUI.setRunning(true);
    const tokenUsage = createTokenUsage();

    try {
      const prepared = prepareProductInput(inputRaw, { maxChars: 20000 });
      const input = prepared.text;
      if (!input) throw new Error('Input vazio após sanitização.');
      prepared.warnings.forEach(warning => {
        PipelineUI.log(warning.message, 'w');
        PipelineUI.toast(warning.message, 'warn');
      });

      const bivolt = Utils.detectBivolt(input);
      telemetryContext.bivolt = bivolt;

      // Salva alterações pendentes em categoria antes de montar os prompts.
      await this._flushOpenEditor();

      // Escolhe as categorias que servem como referência para este produto.
      const allCats = Categories.getAll().filter(hasCategoryDefinition);
      // O backend é a única fonte de decisão para matching. Ele resolve tanto o
      // catálogo publicado quanto o legado ainda não migrado com o mesmo algoritmo.
      const resolution = await Categories.resolveDetailed(input);
      const matched = resolution.categories.slice(0, 1);
      telemetryContext.category = matched[0]?.nome || categoriaAtual || '';
      const categoriaComAviso = matched.find(cat => getCategoryNotice(cat.avisoFichaTipo).text);
      const aviso = categoriaComAviso ? getCategoryNotice(categoriaComAviso.avisoFichaTipo).text : '';
      const avisoValidacao = aviso
        ? `\n\n---\nAVISO OBRIGATORIO DA CATEGORIA:\nO trecho abaixo foi inserido automaticamente por regra interna da categoria "${categoriaComAviso.nome}". Ele deve ser aceito mesmo que nao exista nos dados brutos e nao deve ser tratado como invencao.\n${aviso}`
        : '';
      const unmatched = allCats.filter(c => !matched.includes(c));

      PipelineUI.log(`Pipeline A1 + A2${autoA3 ? ' + A3' : ''} - Modelo Gemini: ${modeloAtual}${mistralOk ? ' - Mistral (A1)' : ''}`, 'i');
      if (mistralOk) PipelineUI.log('Modo mesclado: A1=Mistral - A2=Gemini - A3=Gemini', 'o');
      if (!autoA3) PipelineUI.log('A3 opcional: conteúdo comercial ficará disponível no botão Gerar.', 'i');
      if (bivolt) PipelineUI.log('Modo bivolt detectado (110V + 220V)', 'o');

      if (allCats.length === 0) {
        PipelineUI.log('Nenhuma categoria configurada - processando sem exemplos', 'i');
      } else if (matched.length === 0) {
        PipelineUI.log('Atenção: produto sem categoria correspondente - processando sem exemplos', 'w');
        this._showCategoryWarning();
      } else {
        PipelineUI.log(`${matched.length} categoria(s) aplicada(s): ${matched.map(c => c.nome).join(', ')}`, 'o');
        if (unmatched.length) PipelineUI.log(`-> Ignoradas: ${unmatched.map(c => c.nome).join(', ')}`, 'i');
      }

      const fewShot = Utils.buildFewShot(bivolt, matched);
      const qaSchemaPrompt = buildCategoryQaSchemaPrompt(matched);
      const subcatRule = resolveTitleRule(matched, resolution);
      if (subcatRule) PipelineUI.log(`Padrão de título aplicado: ${subcatRule.nome}`, 'o');

      // Busca keywords SEO sem bloquear o fluxo quando a integração não estiver disponível.
      const contextoSEO = await obterContextoSEO(input, categoriaAtual);
      if (contextoSEO) PipelineUI.log('Contexto SEO carregado.', 'o');

      const prompts = buildPipelinePrompts({
        getPrompt: key => Prompts.get(key),
        bivolt,
        fewShot,
        titleRule: subcatRule,
        seoContext: contextoSEO,
      });
      const emit = createPipelineEventHandler({ tokenUsage });
      const {
        ficha,
        validacao,
        validacaoRaw,
        qa,
        conteudo,
        reprovado,
      } = await runPipelineAgents({
        input,
        bivolt,
        prompts,
        notice: aviso,
        noticeValidation: avisoValidacao,
        qaSchemaPrompt,
        autoRunCopywriter: autoA3,
        signal,
      }, orchestratorDependencies(emit));

      // Salva o resultado em memória antes de atualizar a interface.
      AppState.pipeline.result = {
        ficha,
        validacao,
        validacaoRaw,
        qa,
        conteudo,
        bivolt,
        reprovado,
        category: telemetryContext.category,
        tokenUsage,
      };
      PipelineUI.showResults(ficha, validacao, conteudo, bivolt, reprovado, tokenUsage);
      PipelineUI.log('Pipeline concluído.', 'o');

      // Analytics: pipeline concluído com sucesso.
      trackPipelineConcluido({
        modelo: modeloAtual,
        duracaoMs: Date.now() - t0,
        temSEO: !!contextoSEO,
        bivolt: !!bivolt,
        reprovado: !!reprovado,
      });

      telemetryRecorded = UsageAnalytics.record({
        status: reprovado ? 'reprovado' : 'aprovado',
        durationMs: Date.now() - t0,
        category: telemetryContext.category,
        bivolt: telemetryContext.bivolt,
        calls: tokenUsage.calls,
      });

      // Persistência (Firestore + localStorage como cache local).
      const preview = (document.getElementById('inputText')?.value || '').slice(0, 100).trim();
      const historyId = await History.save({ preview, ficha, conteudo, bivolt, tokenUsage });
      AppState.pipeline.result.historyId = historyId;
      await Logs.save({
        status: reprovado ? 'reprovado' : 'aprovado',
        duracao_ms: Date.now() - t0,
        modelo: modeloAtual,
        bivolt: !!bivolt,
        usou_mistral: mistralOk,
        usou_seo: !!contextoSEO,
        total_tokens: tokenUsage.totalTokens,
        input_tokens: tokenUsage.inputTokens,
        output_tokens: tokenUsage.outputTokens,
      });

      Quota.updateUI();

    } catch (err) {
      if (!telemetryRecorded && tokenUsage.calls.length) {
        UsageAnalytics.record({
          status: 'erro',
          durationMs: Date.now() - t0,
          category: telemetryContext.category,
          bivolt: telemetryContext.bivolt,
          calls: tokenUsage.calls,
        });
      }
      if (err.name === 'AbortError') {
        [1, 2, 3].forEach(n => {
          if (document.getElementById(`ps${n}`)?.classList.contains('active')) PipelineUI.setStep(n, '');
        });
        return;
      }

      // Analytics: erro no pipeline
      trackPipelineErro({
        etapa: 'pipeline',
        erro: err.message,
        modelo: ApiSettings.getModel(),
      });

      PipelineUI.log(`ERRO: ${err.message}`, 'e');
      await Logs.save({ status: 'erro', duracao_ms: Date.now() - t0, erro: err.message });
      [1, 2, 3].forEach(n => {
        if (document.getElementById(`ps${n}`)?.classList.contains('active')) PipelineUI.setStep(n, 'error');
      });
      alert(`Erro:\n${err.message}`);
    } finally {
      PipelineUI.setRunning(false);
    }
  },

  // Sincroniza o editor de categorias aberto antes de processar.
  async _flushOpenEditor() {
    const { active, editorOpen, saveTimer } = AppState.categories;
    if (saveTimer) { clearTimeout(saveTimer); AppState.categories.saveTimer = null; }

    const currentFields = {
      nome: document.getElementById('catEditNome'),
      camposObrigatorios: document.getElementById('catEditObrigatorios'),
      camposOpcionais: document.getElementById('catEditOpcionais'),
      avisoFichaTipo: document.getElementById('catEditAvisoFicha'),
      fichaIdeal: document.getElementById('catEditFichaIdeal'),
    };
    if (active && Object.values(currentFields).every(Boolean)) {
      await Categories.update(active, {
        nome: currentFields.nome.value || 'Sem nome',
        camposObrigatorios: textToFieldList(currentFields.camposObrigatorios.value),
        camposOpcionais: textToFieldList(currentFields.camposOpcionais.value),
        avisoFichaTipo: currentFields.avisoFichaTipo.value || 'normal',
        fichaIdeal: currentFields.fichaIdeal.value,
      });
      return;
    }

    if (!editorOpen || !active) return;
    const legacyFields = {
      nome: document.getElementById('catNome'),
      camposObrigatorios: document.getElementById('catCamposObrigatorios'),
      camposOpcionais: document.getElementById('catCamposOpcionais'),
      fichaIdeal: document.getElementById('catFichaIdeal'),
    };
    if (Object.values(legacyFields).every(Boolean)) {
      await Categories.update(active, {
        nome: legacyFields.nome.value || 'Sem nome',
        camposObrigatorios: textToFieldList(legacyFields.camposObrigatorios.value),
        camposOpcionais: textToFieldList(legacyFields.camposOpcionais.value),
        fichaIdeal: legacyFields.fichaIdeal.value,
      });
    }
  },

  // UI helpers
  _showInputAlerts(alerts) {
    document.getElementById('inputAlertBox')?.remove();
    const box = document.createElement('div');
    box.id = 'inputAlertBox';
    box.style.cssText = 'background:var(--color-bg-subtle);border:1px solid var(--color-warn);border-radius:10px;padding:12px 16px;font-size:12px;color:var(--color-text-secondary);line-height:1.8;display:flex;flex-direction:column;gap:4px;';
    box.innerHTML = alerts.map(a => `<span>${Utils.escHtml(a)}</span>`).join('') +
      `<div style="margin-top:6px;display:flex;gap:10px">
         <button id="forceRunBtn" style="font-size:11px;padding:4px 12px;border-radius:6px;border:1px solid var(--color-warn);background:none;color:var(--color-warn);cursor:pointer;font-weight:600">Processar mesmo assim</button>
         <button id="cancelAlertBtn" style="font-size:11px;padding:4px 12px;border-radius:6px;border:1px solid var(--color-border);background:none;color:var(--color-text-muted);cursor:pointer">Corrigir input</button>
       </div>`;
    const runBtn = document.getElementById('runBtn');
    runBtn?.parentNode?.insertBefore(box, runBtn.nextSibling);
    box.querySelector('#forceRunBtn').addEventListener('click', () => { box.remove(); Pipeline.run(true); });
    box.querySelector('#cancelAlertBtn').addEventListener('click', () => box.remove());
  },

  _showCategoryWarning() {
    document.getElementById('catToast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'catToast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:var(--color-surface);border:1px solid var(--color-warn);border-radius:10px;padding:12px 14px;max-width:300px;box-shadow:0 4px 20px rgba(0,0,0,.15);font-size:13px;color:var(--color-text-secondary);line-height:1.5;animation:slideIn .25s ease;';
    toast.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px">
      <div>
        <strong style="color:var(--color-warn);display:block;margin-bottom:3px">Produto sem categoria correspondente</strong>
        Processando sem exemplos de referência.
      </div>
      <button id="catToastClose" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:16px;flex-shrink:0;padding:0 0 0 6px">x</button>
    </div>`;
    document.body.appendChild(toast);
    toast.querySelector('#catToastClose').addEventListener('click', () => toast.remove());
    setTimeout(() => toast.remove(), 8000);
  },
};
