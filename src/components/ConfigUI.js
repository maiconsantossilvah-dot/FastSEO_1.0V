/**
 * components/ConfigUI.js
 * Gerencia a UI de configuração: API keys, modelo e contador de caracteres.
 */

import { Quota } from '../modules/quota.js';
import { getGoogleApiKey, setGoogleApiKey, getGoogleCx, setGoogleCx } from '../services/serp.js';
import { trackSerpApiConfigurada } from '../services/analytics.js';
import { isValidGeminiKey, isValidGroqKey, isValidMistralKey, isValidProviderKey } from '../utils/apiKeys.js';
import { ApiSettings } from '../services/apiSettings.js';
import { AI_PROVIDER_NAMES, getModelDefinition, getProviderModels, providerLabel } from '../ai/modelCatalog.js';
const $ = id => document.getElementById(id);

export const ConfigUI = {
  // Debounce interno para updateCharCount.
  _charCountTimer: null,

  validateGeminiKey() {
    const v  = $('apiKey')?.value.trim() || '';
    const el = $('apiKey');
    const st = $('keyStatus');
    if (!v) { if (el) el.className = ''; if (st) st.textContent = ''; ApiSettings.setGeminiPrimary(''); return; }
    if (isValidGeminiKey(v)) {
      if (el) el.className = 'valid';
      if (st) st.textContent = 'OK';
      ApiSettings.setGeminiPrimary(v);
    } else {
      if (el) el.className = 'invalid';
      if (st) st.textContent = 'X';
    }
  },

  validateMistralKey() {
    const v  = $('mistralKey')?.value.trim() || '';
    const el = $('mistralKey');
    const st = $('mistralKeyStatus');
    if (!v) { if (el) el.className = ''; if (st) st.textContent = ''; ApiSettings.setMistralPrimary(''); return; }
    if (isValidMistralKey(v)) {
      if (el) el.className = 'valid';
      if (st) st.textContent = 'OK';
      ApiSettings.setMistralPrimary(v);
    } else {
      if (el) el.className = 'invalid';
      if (st) st.textContent = 'X';
    }
  },

  validateGroqKey() {
    const v = $('groqKey')?.value.trim() || '';
    const el = $('groqKey');
    const st = $('groqKeyStatus');
    if (!v) { if (el) el.className = ''; if (st) st.textContent = ''; ApiSettings.setGroqPrimary(''); return; }
    if (isValidGroqKey(v)) {
      if (el) el.className = 'valid';
      if (st) st.textContent = 'OK';
      ApiSettings.setGroqPrimary(v);
    } else {
      if (el) el.className = 'invalid';
      if (st) st.textContent = 'X';
    }
  },

  updateQuotaInfo() {
    const hints = {
      'gemini-3.5-flash-lite': 'Recomendado - maior cota diária gratuita',
      'gemini-3.5-flash':      'Boa qualidade, cota intermediária',
      'gemini-3.1-pro-preview': 'Apenas 100 req/dia - use para tarefas que exigem mais raciocínio',
    };
    const hint = $('modelHint');
    if (hint) hint.textContent = hints[$('modelSel')?.value] || 'Modelo gratuito';
    Quota.updateUI();
  },

  updateCharCount() {
    clearTimeout(this._charCountTimer);
    this._charCountTimer = setTimeout(() => {
      const v  = $('inputText')?.value || '';
      const el = $('charCount');
      if (!el) return;
      el.textContent = `${v.length.toLocaleString()} caracteres`;
      el.className   = `char-count${v.length > 10000 ? ' warn' : ''}`;
    }, 120);
  },

  restoreSavedKeys() {
    const geminiKey  = ApiSettings.getGeminiPrimary();
    const mistralKey = ApiSettings.getMistralPrimary();
    const groqKey = ApiSettings.getGroqPrimary();
    const apiKeyEl   = $('apiKey');
    const mistralEl  = $('mistralKey');
    const groqEl = $('groqKey');
    if (geminiKey  && apiKeyEl)  { apiKeyEl.value  = geminiKey;  this.validateGeminiKey(); }
    if (mistralKey && mistralEl) { mistralEl.value = mistralKey; this.validateMistralKey(); }
    if (groqKey && groqEl) { groqEl.value = groqKey; this.validateGroqKey(); }
    const model = $('modelSel');
    if (model) model.value = ApiSettings.getModel();
  },
  
};

const AGENT_META = Object.freeze({
  1: Object.freeze({ name: 'Formatador', icon: 'wand-sparkles' }),
  2: Object.freeze({ name: 'Conferente / QA', icon: 'badge-check' }),
  3: Object.freeze({ name: 'Copywriter', icon: 'pen-line' }),
});

function agentRouteMarkup(stage) {
  const meta = AGENT_META[stage];
  const provider = ApiSettings.getAgentProvider(stage);
  const options = AI_PROVIDER_NAMES.map(name => (
    `<option value="${name}"${name === provider ? ' selected' : ''}>${providerLabel(name)}</option>`
  )).join('');
  return `
    <article class="agent-route-card" data-agent-route="${stage}">
      <div class="agent-route-card__heading">
        <span class="agent-route-card__icon"><i data-lucide="${meta.icon}" aria-hidden="true"></i></span>
        <div><strong>A${stage}</strong><small>${meta.name}</small></div>
      </div>
      <label for="agent${stage}Provider">Provedor</label>
      <select id="agent${stage}Provider">${options}</select>
      <label for="agent${stage}Model">Modelo</label>
      <select id="agent${stage}Model"></select>
      <p class="agent-route-card__hint" id="agent${stage}Hint"></p>
    </article>`;
}
// initSerpConfig - ativa os eventos da seção SerpAPI no modal.
// Chamada dentro de ConfigModal.open(), após appendChild(overlay).
export function initSerpConfig() {
  const apiKeyInput   = document.getElementById('serp-api-key-input');
  const cxInput       = document.getElementById('serp-cx-input');
  const toggleBtn     = document.getElementById('serp-api-key-toggle');
  const saveBtn       = document.getElementById('serp-api-key-save');
  const status        = document.getElementById('serp-api-status');
  const quotaLabel    = document.getElementById('serp-quota-label');
  const quotaFill     = document.getElementById('serp-quota-fill');
  const clearCacheBtn = document.getElementById('serp-cache-clear');

  if (!apiKeyInput) return; // Seção ainda não foi renderizada no modal.

  // Preenche com valores já salvos.
  const apiKeySalva = getGoogleApiKey();
  const cxSalvo     = getGoogleCx();
  if (apiKeySalva) { apiKeyInput.value = apiKeySalva; }
  if (cxSalvo)     { if (cxInput) cxInput.value = cxSalvo; }
  if (apiKeySalva && cxSalvo) _serpStatus(status, true);
  _serpQuota(quotaLabel, quotaFill);

  // Toggle mostrar/ocultar API key
  toggleBtn?.addEventListener('click', () => {
    const visivel = apiKeyInput.type === 'text';
    apiKeyInput.type = visivel ? 'password' : 'text';
    toggleBtn.textContent = visivel ? 'Mostrar' : 'Ocultar';
  });

  // Salvar chaves
  saveBtn?.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const cx     = cxInput?.value.trim() || '';
    if (!apiKey) { _serpStatus(status, false, 'Cole sua API Key do Google antes de salvar.'); return; }
    if (!cx)     { _serpStatus(status, false, 'Cole o Search Engine ID (cx) antes de salvar.'); return; }
    setGoogleApiKey(apiKey);
    setGoogleCx(cx);
    trackSerpApiConfigurada();
    _serpStatus(status, true, 'Chaves salvas com sucesso!');
    setTimeout(() => _serpStatus(status, true), 3000);
  });

  // Limpar cache
  clearCacheBtn?.addEventListener('click', () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('fastseo_serp_cache_'))
      .forEach(k => localStorage.removeItem(k));
    _serpQuota(quotaLabel, quotaFill);
    clearCacheBtn.textContent = 'Cache limpo!';
    setTimeout(() => { clearCacheBtn.textContent = 'Limpar cache'; }, 2000);
  });
}

function _serpStatus(el, ok, mensagem) {
  if (!el) return;
  el.textContent = mensagem ?? (ok ? 'Chave configurada' : '');
  el.className   = `serp-status ${ok ? 'serp-status--ok' : mensagem ? 'serp-status--erro' : ''}`;
}

function _serpQuota(labelEl, fillEl) {
  const mes   = new Date().toISOString().slice(0, 7);
  const count = parseInt(localStorage.getItem(`fastseo_serp_count_${mes}`) || '0');
  const pct   = Math.min((count / 100) * 100, 100);
  if (labelEl) labelEl.textContent = `${count} / 100 buscas este mês`;
  if (fillEl) {
    fillEl.style.width      = `${pct}%`;
    fillEl.style.background = pct > 80 ? 'var(--color-warn)' : 'var(--color-success)';
  }
}


/**
 * ConfigModal - modal de configuração de APIs e modelo.
 *
 * Estratégia: os inputs de credenciais vivem em
 * #hiddenApiInputs (fora da tela) apenas para preservar o estado visual.
 * Ao abrir o modal, os inputs são MOVIDOS para dentro dele.
 * Ao fechar, são DEVOLVIDOS ao container oculto.
 */
export const ConfigModal = {
  _eventController: null,

  open() {
    if (document.getElementById('configModalOverlay')) return;

    this._eventController?.abort();
    this._eventController = new AbortController();
    const { signal } = this._eventController;

    const overlay = document.createElement('div');
    overlay.id = 'configModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal--lg modal--config">
        <div class="modal-hdr">
          <span class="modal-title"><i data-lucide="key-round" aria-hidden="true"></i> APIs e modelos</span>
          <button class="modal-close" id="configModalClose" type="button" aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button>
        </div>
        <div class="modal-body" style="gap:20px">

          <section class="config-block">
            <div class="config-block__heading">
              <div><span>Credenciais BYOK</span><p>Cada chave permanece somente neste navegador e neste usuário.</p></div>
            </div>
            <div class="setup-grid setup-grid--providers">
            <div class="field">
              <label for="apiKey">API Key do Gemini</label>
              <div class="key-wrap" id="apiKeySlot"><span class="key-status" id="keyStatus"></span></div>
              <div class="hint">Obtenha grátis em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></div>
            </div>
            <div class="field">
              <label for="mistralKey">API Key da Mistral</label>
              <div class="key-wrap" id="mistralKeySlot"><span class="key-status" id="mistralKeyStatus"></span></div>
              <div class="hint">Configure em <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener">console.mistral.ai</a></div>
            </div>
            <div class="field">
              <label for="groqKey">API Key da Groq <span class="fallback-badge">novo</span></label>
              <div class="key-wrap" id="groqKeySlot"><span class="key-status" id="groqKeyStatus"></span></div>
              <div class="hint">Crie grátis em <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a></div>
            </div>
            <div class="field">
              <label>Conteúdo comercial</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--color-text-secondary);font-weight:500">
                <input type="checkbox" id="autoA3Check" style="width:auto">
                Gerar A3 automaticamente
              </label>
              <div class="hint">Desative para economizar 1 chamada por ficha e gerar depois pelo botão.</div>
            </div>
          </div>
          </section>

          <section class="config-block">
            <div class="config-block__heading">
              <div><span>Roteamento por agente</span><p>Escolha de forma independente qual provedor e modelo executará cada etapa.</p></div>
            </div>
            <div class="agent-route-grid">
              ${[1, 2, 3].map(agentRouteMarkup).join('')}
            </div>
            <div class="config-free-tier-note"><i data-lucide="info" aria-hidden="true"></i><span>Na Groq, apenas GPT-OSS 20B e 120B são exibidos. O plano gratuito limita esses modelos a 8 mil tokens por minuto; fichas maiores podem receber erro 429.</span></div>
          </section>

          <details class="config-advanced">
            <summary>
              <span><i data-lucide="waypoints" aria-hidden="true"></i> Chaves de fallback</span>
              <small>Configuração avançada</small>
            </summary>
            <div class="hint">Acionadas automaticamente quando a chave primária retornar 503, 529 ou sobrecarga.</div>
            <div class="setup-grid">
              <div class="field">
                <label for="apiKey2">Gemini &mdash; Chave 2 <span class="fallback-badge">fallback</span></label>
                <div class="key-wrap" id="apiKey2Slot"><span class="key-status" id="keyStatus2"></span></div>
              </div>
              <div class="field">
                <label for="mistralKey2">Mistral &mdash; Chave 2 <span class="fallback-badge">fallback</span></label>
                <div class="key-wrap" id="mistralKey2Slot"><span class="key-status" id="mistralKeyStatus2"></span></div>
              </div>
              <div class="field">
                <label for="apiKey3">Gemini &mdash; Chave 3 <span class="fallback-badge">fallback</span></label>
                <div class="key-wrap" id="apiKey3Slot"><span class="key-status" id="keyStatus3"></span></div>
              </div>
              <div class="field">
                <label for="groqKey2">Groq &mdash; Chave 2 <span class="fallback-badge">fallback</span></label>
                <div class="key-wrap" id="groqKey2Slot"><span class="key-status" id="groqKeyStatus2"></span></div>
              </div>
            </div>
          </details>
        </div>
        <div class="modal-ftr">
          <span class="modal-saved" id="configSavedMsg"><i data-lucide="check" aria-hidden="true"></i> Salvo</span>
          <span style="flex:1"></span>
          <button class="btn btn-primary" id="configModalClose2" type="button">Concluir</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Ativa os eventos do painel SerpAPI.
    initSerpConfig();

    // Move os controles reais para o modal sem duplicá-los.
    const moveToSlot = (inputId, slotId) => {
      const input = document.getElementById(inputId);
      const slot  = document.getElementById(slotId);
      if (input && slot) slot.prepend(input);
    };
    moveToSlot('apiKey',     'apiKeySlot');
    moveToSlot('mistralKey', 'mistralKeySlot');
    moveToSlot('groqKey',    'groqKeySlot');

    // Cria e move inputs de fallback; eles ficam visíveis somente neste modal.
    this._ensureFallbackInputs();
    moveToSlot('apiKey2',    'apiKey2Slot');
    moveToSlot('apiKey3',    'apiKey3Slot');
    moveToSlot('mistralKey2','mistralKey2Slot');
    moveToSlot('groqKey2',   'groqKey2Slot');

    this._setupAgentRoutes(signal);
    const autoA3El = document.getElementById('autoA3Check');
    try {
      if (autoA3El) autoA3El.checked = localStorage.getItem('fastseo_auto_a3') !== '0';
    } catch { /* Preferências locais são opcionais. */ }

    // Listeners
    document.getElementById('apiKey')?.addEventListener('input', () => { ConfigUI.validateGeminiKey(); this._refreshAgentHints(); this._showSaved(); }, { signal });
    document.getElementById('mistralKey')?.addEventListener('input', () => { ConfigUI.validateMistralKey(); this._refreshAgentHints(); this._showSaved(); }, { signal });
    document.getElementById('groqKey')?.addEventListener('input', () => { ConfigUI.validateGroqKey(); this._refreshAgentHints(); this._showSaved(); }, { signal });
    autoA3El?.addEventListener('change', () => {
      try { localStorage.setItem('fastseo_auto_a3', autoA3El.checked ? '1' : '0'); }
      catch { /* A configuração continua válida apenas nesta sessão. */ }
      this._showSaved();
    }, { signal });

    // Fallback listeners
    [['apiKey2','keyStatus2','gemini'],['apiKey3','keyStatus3','gemini'],['mistralKey2','mistralKeyStatus2','mistral'],['groqKey2','groqKeyStatus2','groq']].forEach(([id,stId,provider]) => {
      const el = document.getElementById(id);
      const st = document.getElementById(stId);
      if (!el) return;
      el.addEventListener('input', () => {
        const v = el.value.trim();
        const ok = isValidProviderKey(provider, v);
        if (!v) {
          el.className = '';
          if (st) st.textContent = '';
          ApiSettings.setFallback(id, '');
          this._refreshAgentHints();
          this._showSaved();
          return;
        }
        el.className = ok ? 'valid' : 'invalid';
        if (st) st.textContent = ok ? 'OK' : 'X';
        if (ok) ApiSettings.setFallback(id, v);
        this._refreshAgentHints();
        this._showSaved();
      }, { signal });
    });

    const close = () => this.close();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('configModalClose')?.addEventListener('click', close);
    document.getElementById('configModalClose2')?.addEventListener('click', close);
    document.addEventListener('keydown', this._esc);
  },

  // Garante que os inputs de fallback existem no DOM (oculto)
  _ensureFallbackInputs() {
    const hidden = document.getElementById('hiddenApiInputs');
    if (!hidden) return;
    const fallbacks = [
      { id: 'apiKey2',     placeholder: 'AIza... ou AQ.... (secundária)' },
      { id: 'apiKey3',     placeholder: 'AIza... ou AQ.... (terciária)'  },
      { id: 'mistralKey2', placeholder: '... (secundária)'     },
      { id: 'groqKey2',    placeholder: 'gsk_... (secundária)' },
    ];
    fallbacks.forEach(({ id, placeholder }) => {
      if (!document.getElementById(id)) {
        const inp = document.createElement('input');
        inp.type = 'password'; inp.id = id; inp.placeholder = placeholder;
        inp.autocomplete = 'off';
        const saved = ApiSettings.getFallback(id);
        if (saved) inp.value = saved;
        hidden.appendChild(inp);
      }
    });
  },

  _setupAgentRoutes(signal) {
    [1, 2, 3].forEach(stage => {
      const providerEl = document.getElementById(`agent${stage}Provider`);
      const modelEl = document.getElementById(`agent${stage}Model`);
      if (!providerEl || !modelEl) return;
      this._populateAgentModels(stage);
      providerEl.addEventListener('change', () => {
        ApiSettings.setAgentProvider(stage, providerEl.value);
        this._populateAgentModels(stage);
        ConfigUI.updateQuotaInfo();
        this._showSaved();
      }, { signal });
      modelEl.addEventListener('change', () => {
        ApiSettings.setAgentModel(stage, providerEl.value, modelEl.value);
        this._refreshAgentHint(stage);
        ConfigUI.updateQuotaInfo();
        this._showSaved();
      }, { signal });
    });
    this._refreshAgentHints();
  },

  _populateAgentModels(stage) {
    const provider = document.getElementById(`agent${stage}Provider`)?.value || ApiSettings.getAgentProvider(stage);
    const modelEl = document.getElementById(`agent${stage}Model`);
    if (!modelEl) return;
    const selected = ApiSettings.getAgentModel(stage, provider);
    modelEl.replaceChildren(...getProviderModels(provider).map(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.label;
      option.selected = model.id === selected;
      return option;
    }));
    ApiSettings.setAgentModel(stage, provider, modelEl.value);
    this._refreshAgentHint(stage);
  },

  _refreshAgentHints() {
    [1, 2, 3].forEach(stage => this._refreshAgentHint(stage));
  },

  _refreshAgentHint(stage) {
    const provider = document.getElementById(`agent${stage}Provider`)?.value || ApiSettings.getAgentProvider(stage);
    const model = document.getElementById(`agent${stage}Model`)?.value || ApiSettings.getAgentModel(stage, provider);
    const hint = document.getElementById(`agent${stage}Hint`);
    if (!hint) return;
    const hasKey = ApiSettings.getProviderKeys(provider).some(key => isValidProviderKey(provider, key));
    const definition = getModelDefinition(provider, model);
    hint.textContent = `${hasKey ? 'Chave configurada.' : `Adicione uma chave ${providerLabel(provider)}.`} ${definition?.hint || ''}`;
    hint.classList.toggle('is-warning', !hasKey);
  },

  _showSaved() {
    const msg = document.getElementById('configSavedMsg');
    if (!msg) return;
    msg.classList.add('show');
    clearTimeout(this._savedTimer);
    this._savedTimer = setTimeout(() => msg.classList.remove('show'), 1800);
  },

  close() {
    this._eventController?.abort();
    this._eventController = null;
    // Devolver inputs ao container oculto antes de remover o modal
    const hidden = document.getElementById('hiddenApiInputs');
    if (hidden) {
      ['apiKey','mistralKey','groqKey','modelSel','apiKey2','apiKey3','mistralKey2','groqKey2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) hidden.appendChild(el);
      });
    }
    document.getElementById('configModalOverlay')?.remove();
    document.removeEventListener('keydown', this._esc);
  },

  _esc(e) { if (e.key === 'Escape') ConfigModal.close(); },
};

