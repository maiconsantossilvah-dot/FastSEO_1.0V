/**
 * modules/pipeline.js
 * ────────────────────
 * Orquestra o fluxo de 3 agentes:
 *   1. Formatador (A1 → Mistral)
 *   2. Conferente/QA (A2 → Gemini)
 *   3. Copywriter (A3 → Gemini)
 *
 * Depende de:
 *   services/api.js         → callAgent()
 *   modules/prompts.js      → Prompts.get()
 *   modules/categories.js   → Categories.getAll()
 *   modules/quota.js        → Quota
 *   modules/history.js      → History.save()
 *   modules/logs.js         → Logs.save()
 *   utils/index.js          → sanitize, detectBivolt, …
 *   components/PipelineUI.js
 */

import { callAgent }    from '../services/api.js';
import { Prompts }      from './prompts.js';
import { Categories }   from './categories.js';
import { Quota }        from './quota.js';
import { History }      from './history.js';
import { Logs }         from './logs.js';
import { Utils }        from '../utils/index.js';
import { PipelineUI }   from '../components/PipelineUI.js';
import { AppState }     from './state.js';

export const Pipeline = {
  /**
   * Ponto de entrada público.
   * @param {boolean} forced - Ignora alertas de validação de input
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

  // ─── Execução principal ─────────────────────────────────────
  async _execute(inputRaw) {
    const t0 = Date.now();

    const geminiKey  = document.getElementById('apiKey')?.value.trim()     || '';
    const mistralKey = document.getElementById('mistralKey')?.value.trim() || '';
    const anyKeyOk   = (geminiKey.startsWith('AIza') && geminiKey.length > 20)
                    || mistralKey.length > 20;

    if (!anyKeyOk)         { alert('Configure pelo menos uma API Key (Gemini ou Mistral) antes de continuar.'); return; }
    if (!inputRaw.trim())  { alert('Cole os dados do produto antes de processar.'); return; }

    // Aborta execução anterior, se houver
    if (AppState.pipeline.abort) AppState.pipeline.abort.abort();
    AppState.pipeline.abort = new AbortController();
    const signal = AppState.pipeline.abort.signal;

    // Verificação de cota
    const uso = Quota.getUsage(), lim = Quota.getLimit();
    if (uso.count + 2 > lim) {
      alert(`Cota diária esgotada (${uso.count}/${lim}). A cota renova à meia-noite.`);
      return;
    }
    if (uso.count + 3 > lim) {
      PipelineUI.log(`⚠ Atenção: cota baixa (${uso.count}/${lim}) — A3 pode não ter cota suficiente.`, 'w');
    }

    PipelineUI.clearResults();
    AppState.pipeline.result = {};
    PipelineUI.resetSteps();
    PipelineUI.setRunning(true);

    try {
      const input  = Utils.sanitize(inputRaw);
      if (!input) throw new Error('Input vazio após sanitização.');

      const bivolt = Utils.detectBivolt(input);

      // Flush de modal aberto (auto-save antes de processar)
      this._flushOpenEditor();

      // Matching de categorias
      const allCats   = Categories.getAll().filter(c => c.ficha || c.campos || c.copy);
      const matched   = Utils.matchCategories(input, Categories.getAll());
      const unmatched = allCats.filter(c => !matched.includes(c));

      const mistralOk = mistralKey.length > 20;
      PipelineUI.log(`Modelo Gemini: ${document.getElementById('modelSel')?.value}${mistralOk ? ' · Mistral (A1)' : ''}`, 'i');
      if (mistralOk) PipelineUI.log('🔀 Modo mesclado: A1=Mistral · A2=Gemini · A3=Gemini', 'o');
      if (bivolt)    PipelineUI.log('⚡ Modo bivolt detectado (110V + 220V)', 'o');

      if (allCats.length === 0) {
        PipelineUI.log('📂 Nenhuma categoria configurada — processando sem exemplos', 'i');
      } else if (matched.length === 0) {
        PipelineUI.log('⚠ Produto sem categoria correspondente — processando sem exemplos', 'w');
        this._showCategoryWarning(allCats.map(c => c.nome));
      } else {
        PipelineUI.log(`📚 ${matched.length} categoria(s) aplicada(s): ${matched.map(c => c.nome).join(', ')}`, 'o');
        if (unmatched.length) PipelineUI.log(`↳ Ignoradas: ${unmatched.map(c => c.nome).join(', ')}`, 'i');
      }

      const fewShot    = Utils.buildFewShot(bivolt, matched);
      const hasFewShot = fewShot.length > 0;
      const tok1       = (bivolt ? 1500 : 1200) + (hasFewShot ? 300 : 0);

      const subcatRule    = AppState.subcatRules.match(input);
      const subcatSnippet = AppState.subcatRules.buildSnippet(subcatRule);
      if (subcatRule) PipelineUI.log(`📐 Padrão de título aplicado: ${subcatRule.nome}`, 'o');

      const sys1 = Prompts.get(bivolt ? 'P1B' : 'P1') + fewShot + subcatSnippet;
      const sys2 = Prompts.get(bivolt ? 'P2B' : 'P2');
      const sys3 = Prompts.get(bivolt ? 'P3B' : 'P3') + fewShot + subcatSnippet;

      // ── AGENTE 1 — Formatador ────────────────────────────────
      PipelineUI.setStep(1, 'active');
      PipelineUI.log(`[A1] Formatando ficha${bivolt ? ' bivolt' : ''}...`, 'i');
      const ficha = await callAgent(sys1, `Dados do produto:\n${input}`, tok1, signal, 1);
      Quota.add(1);
      PipelineUI.setStep(1, 'done');
      PipelineUI.log('[A1] Ficha formatada.', 'o');

      // ── AGENTE 2 — Conferente/QA ─────────────────────────────
      PipelineUI.setStep(2, 'active');
      PipelineUI.log('[A2] Conferindo dados...', 'i');
      const validacao  = await callAgent(
        sys2,
        `DADOS BRUTOS ORIGINAIS:\n${input}\n\n---\nFICHA GERADA:\n${ficha}`,
        400, signal, 2
      );
      Quota.add(1);
      const reprovado = validacao.toUpperCase().includes('REPROVADO');
      PipelineUI.setStep(2, reprovado ? 'error' : 'done');
      PipelineUI.log(`[A2] ${reprovado ? 'REPROVADO' : 'APROVADO'}`, reprovado ? 'w' : 'o');

      // ── AGENTE 3 — Copywriter ────────────────────────────────
      let conteudo = '';
      if (!reprovado) {
        PipelineUI.setStep(3, 'active');
        PipelineUI.log('[A3] Gerando conteúdo comercial...', 'i');
        conteudo = await callAgent(sys3, ficha, 500, signal, 3);
        Quota.add(1);
        PipelineUI.setStep(3, 'done');
        PipelineUI.log('[A3] Conteúdo gerado.', 'o');
      } else {
        PipelineUI.setStep(3, 'skip');
        PipelineUI.log('[A3] Pulado.', 'w');
      }

      // Salvar resultado no estado
      AppState.pipeline.result = { ficha, validacao, conteudo, bivolt, reprovado };
      PipelineUI.showResults(ficha, validacao, conteudo, bivolt, reprovado);
      PipelineUI.log('Pipeline concluído.', 'o');

      // Persistência (Firestore + localStorage como cache local)
      const preview = (document.getElementById('inputText')?.value || '').slice(0, 100).trim();
      await History.save({ preview, ficha, conteudo, bivolt });
      await Logs.save({
        status:      reprovado ? 'reprovado' : 'aprovado',
        duracao_ms:  Date.now() - t0,
        modelo:      document.getElementById('modelSel')?.value,
        bivolt:      !!bivolt,
        usou_mistral: mistralOk,
      });

      Quota.updateUI();

    } catch (err) {
      if (err.name === 'AbortError') {
        [1, 2, 3].forEach(n => {
          if (document.getElementById(`ps${n}`)?.classList.contains('active')) PipelineUI.setStep(n, '');
        });
        return;
      }
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

  // ─── Flush do editor aberto antes de processar ───────────────
  _flushOpenEditor() {
    const { active, editorOpen, saveTimer } = AppState.categories;
    if (saveTimer) { clearTimeout(saveTimer); AppState.categories.saveTimer = null; }
    if (!editorOpen || !active) return;
    const fields = {
      nome:   document.getElementById('catNome'),
      campos: document.getElementById('catCampos'),
      ficha:  document.getElementById('catFicha'),
      copy:   document.getElementById('catCopy'),
    };
    if (Object.values(fields).every(Boolean)) {
      Categories.update(active, {
        nome:   fields.nome.value   || undefined,
        campos: fields.campos.value,
        ficha:  fields.ficha.value,
        copy:   fields.copy.value,
      });
    }
  },

  // ─── UI helpers ─────────────────────────────────────────────
  _showInputAlerts(alerts) {
    document.getElementById('inputAlertBox')?.remove();
    const box = document.createElement('div');
    box.id = 'inputAlertBox';
    box.style.cssText = 'background:var(--color-bg-subtle);border:1px solid var(--color-warn);border-radius:10px;padding:12px 16px;font-size:12px;color:var(--color-text-secondary);line-height:1.8;display:flex;flex-direction:column;gap:4px;';
    box.innerHTML = alerts.map(a => `<span>${a}</span>`).join('') +
      `<div style="margin-top:6px;display:flex;gap:10px">
         <button id="forceRunBtn" style="font-size:11px;padding:4px 12px;border-radius:6px;border:1px solid var(--color-warn);background:none;color:var(--color-warn);cursor:pointer;font-weight:600">Processar mesmo assim</button>
         <button id="cancelAlertBtn" style="font-size:11px;padding:4px 12px;border-radius:6px;border:1px solid var(--color-border);background:none;color:var(--color-text-muted);cursor:pointer">Corrigir input</button>
       </div>`;
    const runBtn = document.getElementById('runBtn');
    runBtn?.parentNode?.insertBefore(box, runBtn.nextSibling);
    box.querySelector('#forceRunBtn').addEventListener('click', () => { box.remove(); Pipeline.run(true); });
    box.querySelector('#cancelAlertBtn').addEventListener('click', () => box.remove());
  },

  _showCategoryWarning(names) {
    document.getElementById('catToast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'catToast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:var(--color-surface);border:1px solid var(--color-warn);border-radius:10px;padding:14px 18px;max-width:320px;box-shadow:0 4px 20px rgba(0,0,0,.15);font-size:13px;color:var(--color-text-secondary);line-height:1.6;animation:slideIn .25s ease;';
    toast.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px">
      <span style="font-size:18px;flex-shrink:0">⚠️</span>
      <div>
        <strong style="color:var(--color-warn);display:block;margin-bottom:4px">Produto sem categoria correspondente</strong>
        Nenhuma categoria (${names.map(n => `<em>${Utils.escHtml(n)}</em>`).join(', ')}) foi identificada.
        O pipeline continua <strong>sem exemplos de referência</strong>.
      </div>
      <button id="catToastClose" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:16px;flex-shrink:0;padding:0 0 0 6px">✕</button>
    </div>`;
    document.body.appendChild(toast);
    toast.querySelector('#catToastClose').addEventListener('click', () => toast.remove());
    setTimeout(() => toast.remove(), 8000);
  },
};
