/**
 * services/api.js
 * Camada de servico para chamadas as APIs de IA.
 * Inclui fila por provedor, espera automatica em limite por minuto e fallback.
 */

import { GEMINI_DEFAULT_MODEL, MISTRAL_MODEL } from '../config.js';
import { PipelineUI } from '../components/PipelineUI.js';

function _sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function _ls(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }
function _getGeminiKey()  { return document.getElementById('apiKey')?.value.trim()    || ''; }
function _getMistralKey() { return document.getElementById('mistralKey')?.value.trim() || ''; }
function _getModel()      { return document.getElementById('modelSel')?.value || GEMINI_DEFAULT_MODEL; }

function _getGeminiKeys() {
  return [_getGeminiKey(), _ls('fastseo_apiKey2'), _ls('fastseo_apiKey3')]
    .map(k => k.trim())
    .filter((k, i, arr) => k.startsWith('AIza') && k.length > 20 && arr.indexOf(k) === i);
}

function _getMistralKeys() {
  return [_getMistralKey(), _ls('fastseo_mistralKey2')]
    .map(k => k.trim())
    .filter((k, i, arr) => k.length > 20 && arr.indexOf(k) === i);
}

const _queue = {
  gemini:  { chain: Promise.resolve(), nextAt: 0, minDelay: 4500 },
  mistral: { chain: Promise.resolve(), nextAt: 0, minDelay: 4500 },
};

function _retryAfterMs(res) {
  const raw = res.headers?.get?.('retry-after');
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(1000, seconds * 1000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(1000, date - Date.now()) : null;
}

function _isDailyQuota(msg) {
  return /daily|per day|quota.*day|requests per day|cota di[aá]ria/i.test(msg || '');
}

function _isOverloaded(msg) {
  return /overloaded|service.?unavailable|capacity|too many|temporarily unavailable/i.test(msg || '');
}

async function _queuedFetch(provider, fetcher, signal) {
  const q = _queue[provider];
  const run = q.chain.catch(() => {}).then(async () => {
    const wait = Math.max(0, q.nextAt - Date.now());
    if (wait > 500) {
      PipelineUI.log(`Fila ${provider}: aguardando ${Math.ceil(wait / 1000)}s para respeitar o limite por minuto.`, 'i');
      await _sleep(wait, signal);
    }
    try {
      return await fetcher();
    } finally {
      q.nextAt = Date.now() + q.minDelay;
    }
  });
  q.chain = run.catch(() => {});
  return run;
}

async function _requestWithAutoWait(provider, fetcher, signal, attempt = 1) {
  const res = await _queuedFetch(provider, fetcher, signal);

  if (res.status === 429) {
    const maxRetries = provider === 'gemini' ? 2 : 5;
    const retryAfter = _retryAfterMs(res);
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || body?.message || '';

    if (_isDailyQuota(msg)) {
      throw Object.assign(new Error('cota_esgotada'), { cotaEsgotada: true, dailyQuota: true, provider });
    }

    if (attempt <= maxRetries) {
      const waitMs = retryAfter || Math.min(90000, attempt * 15000);
      PipelineUI.log(`Limite por minuto (${provider}). Tentativa ${attempt}/${maxRetries} em ${Math.ceil(waitMs / 1000)}s...`, 'w');
      await _sleep(waitMs, signal);
      return _requestWithAutoWait(provider, fetcher, signal, attempt + 1);
    }

    throw Object.assign(new Error(`Limite por minuto persistente (${provider}).`), {
      cotaEsgotada: true,
      rateLimit: true,
      fallbackEligible: provider === 'gemini',
      provider,
    });
  }

  return res;
}

export async function callGemini(system, userMsg, maxTokens, attempt = 1, signal = null, options = {}) {
  const model = _getModel();
  const keys = _getGeminiKeys();
  if (!keys.length) throw new Error('API Key do Gemini nao configurada.');
  const generationConfig = {
    maxOutputTokens: maxTokens,
    temperature: options.jsonMode ? 0 : 0.3,
    ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
  };

  let lastErr = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    try {
      const res = await _requestWithAutoWait('gemini', () => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          generationConfig,
        }),
      }), signal);

      if (res.status === 503 || res.status === 529) {
        const e = await res.json().catch(() => ({}));
        const msg = e?.error?.message || `HTTP ${res.status}`;
        throw Object.assign(new Error(msg), { cotaEsgotada: true, fallbackEligible: true });
      }

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        const msg = e?.error?.message || '';
        if (_isOverloaded(msg)) throw Object.assign(new Error(msg), { cotaEsgotada: true, fallbackEligible: true });
        if (res.status === 400) throw Object.assign(new Error('API Key do Gemini invalida. Verifique em aistudio.google.com'), { invalidKey: true });
        throw new Error(`Gemini: ${msg || 'HTTP ' + res.status}`);
      }

      const d = await res.json();
      const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!txt) throw new Error('Resposta vazia do Gemini.');
      return txt;
    } catch (err) {
      lastErr = err;
      if (err.name === 'AbortError') throw err;
      if (err.provider === 'gemini' && (err.rateLimit || err.dailyQuota)) throw err;
      if ((err.dailyQuota || err.fallbackEligible || err.rateLimit || err.invalidKey) && i < keys.length - 1) {
        PipelineUI.log(`Gemini chave ${i + 1} indisponivel. Tentando chave ${i + 2}...`, 'w');
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error('Gemini indisponivel.');
}

export async function callMistral(system, userMsg, maxTokens, signal = null, attempt = 0, options = {}) {
  const keys = _getMistralKeys();
  if (!keys.length) throw new Error('API Key da Mistral nao configurada.');

  let lastErr = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    try {
      const res = await _requestWithAutoWait('mistral', () => fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        signal,
        body: JSON.stringify({
          model:       MISTRAL_MODEL,
          max_tokens:  maxTokens,
          temperature: options.jsonMode ? 0 : 0.3,
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          messages: [
            { role: 'system', content: system },
            { role: 'user',   content: userMsg },
          ],
        }),
      }), signal);

      if (res.status === 503 || res.status === 529) {
        const e = await res.json().catch(() => ({}));
        const msg = e?.message || `HTTP ${res.status}`;
        throw Object.assign(new Error(msg), { cotaEsgotada: true, fallbackEligible: true });
      }

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        const msg = e?.message || '';
        if (_isDailyQuota(msg)) throw Object.assign(new Error('cota_esgotada'), { cotaEsgotada: true, dailyQuota: true });
        if (_isOverloaded(msg)) throw Object.assign(new Error(msg), { cotaEsgotada: true, fallbackEligible: true });
        if (res.status === 401) throw Object.assign(new Error('API Key da Mistral invalida. Verifique em console.mistral.ai'), { invalidKey: true });
        throw new Error(`Mistral: ${msg || 'HTTP ' + res.status}`);
      }

      const d = await res.json();
      const txt = d?.choices?.[0]?.message?.content?.trim();
      if (!txt) throw new Error('Resposta vazia da Mistral.');
      return txt;
    } catch (err) {
      lastErr = err;
      if (err.name === 'AbortError') throw err;
      if ((err.dailyQuota || err.fallbackEligible || err.rateLimit || err.invalidKey) && i < keys.length - 1) {
        PipelineUI.log(`Mistral chave ${i + 1} indisponivel. Tentando chave ${i + 2}...`, 'w');
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error('Mistral indisponivel.');
}

export async function callAgent(system, userMsg, maxTokens, signal, agentNum) {
  const mistralOk = _getMistralKeys().length > 0;
  const geminiOk  = _getGeminiKeys().length > 0;
  const options = { jsonMode: agentNum === 2 };

  const tryFallback = async (skipApi, label) => {
    if (skipApi !== 'mistral' && mistralOk) {
      PipelineUI.log(`${label} - usando Mistral como fallback...`, 'w');
      try { return await callMistral(system, userMsg, maxTokens, signal, 0, options); }
      catch (e2) {
        if (!e2.cotaEsgotada) throw e2;
        PipelineUI.log('Mistral tambem indisponivel no fallback.', 'w');
      }
    }
    if (skipApi !== 'gemini' && geminiOk) {
      PipelineUI.log(`${label} - usando Gemini como fallback...`, 'w');
      return callGemini(system, userMsg, maxTokens, 1, signal, options);
    }
    throw new Error(`Todas as APIs falharam no A${agentNum}. Verifique chaves, cotas e tente novamente em alguns minutos.`);
  };

  if (agentNum === 1) {
    if (!mistralOk) {
      PipelineUI.log('Mistral nao configurada no A1 - usando Gemini como fallback...', 'w');
      return tryFallback('mistral', 'A1 sem Mistral');
    }
    try { return await callMistral(system, userMsg, maxTokens, signal, 0, options); }
    catch (err) {
      if (err.cotaEsgotada) return tryFallback('mistral', 'Mistral indisponivel no A1');
      throw err;
    }
  }

  if (!geminiOk) {
    PipelineUI.log(`Gemini nao configurada no A${agentNum} - usando Mistral como fallback...`, 'w');
    return tryFallback('gemini', `A${agentNum} sem Gemini`);
  }
  try { return await callGemini(system, userMsg, maxTokens, 1, signal, options); }
  catch (err) {
    if (err.cotaEsgotada) return tryFallback('gemini', `Gemini indisponivel no A${agentNum}`);
    throw err;
  }
}
