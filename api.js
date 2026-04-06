/**
 * services/api.js
 * ───────────────
 * Camada de serviço para chamadas às APIs de IA.
 * Gemini (A2, A3) e Mistral (A1) ficam aqui.
 *
 * ⚠️ As chaves são lidas do DOM (inseridas pelo usuário)
 *    e nunca hardcoded. Ver config.js para contexto de segurança.
 */

import { GEMINI_DEFAULT_MODEL, MISTRAL_MODEL } from '../config.js';
import { PipelineUI } from '../components/PipelineUI.js';

// ─── Helpers internos ────────────────────────────────────────
function _sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function _getGeminiKey()  { return document.getElementById('apiKey')?.value.trim()    || ''; }
function _getMistralKey() { return document.getElementById('mistralKey')?.value.trim() || ''; }
function _getModel()      { return document.getElementById('modelSel')?.value || GEMINI_DEFAULT_MODEL; }

// ─────────────────────────────────────────────────────────────
// GEMINI
// ─────────────────────────────────────────────────────────────
/**
 * Chama a API do Gemini com retry automático em 429.
 * @param {string} system    - Prompt de sistema
 * @param {string} userMsg   - Mensagem do usuário
 * @param {number} maxTokens - Limite de tokens de saída
 * @param {number} attempt   - Tentativa atual (interno)
 * @param {AbortSignal} signal
 * @returns {Promise<string>} Texto gerado
 */
export async function callGemini(system, userMsg, maxTokens, attempt = 1, signal = null) {
  const key   = _getGeminiKey();
  const model = _getModel();
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userMsg }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
    }),
  });

  if (res.status === 429) {
    const e   = await res.json().catch(() => ({}));
    const msg = e?.error?.message || '';
    if (/quota|daily|resource_exhausted|exhausted/i.test(msg)) {
      throw Object.assign(new Error('cota_esgotada'), { cotaEsgotada: true });
    }
    if (attempt <= 3) {
      const wait = attempt * 15;
      PipelineUI.log(`⏳ Limite por minuto (Gemini). Aguardando ${wait}s...`, 'w');
      await _sleep(wait * 1000, signal);
      return callGemini(system, userMsg, maxTokens, attempt + 1, signal);
    }
    throw Object.assign(new Error('cota_esgotada'), { cotaEsgotada: true });
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    if (res.status === 400) throw new Error('API Key do Gemini inválida. Verifique em aistudio.google.com');
    throw new Error(`Gemini: ${e?.error?.message || 'HTTP ' + res.status}`);
  }

  const d   = await res.json();
  const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!txt) throw new Error('Resposta vazia do Gemini.');
  return txt;
}

// ─────────────────────────────────────────────────────────────
// MISTRAL
// ─────────────────────────────────────────────────────────────
/**
 * Chama a API do Mistral com retry automático em 429.
 */
export async function callMistral(system, userMsg, maxTokens, signal = null, attempt = 0) {
  const key = _getMistralKey();
  if (!key) throw new Error('API Key da Mistral não configurada.');

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    signal,
    body: JSON.stringify({
      model:       MISTRAL_MODEL,
      max_tokens:  maxTokens,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: userMsg },
      ],
    }),
  });

  if (res.status === 429) {
    if (attempt < 1) {
      PipelineUI.log('⏳ Limite por minuto (Mistral). Aguardando 15s...', 'w');
      await _sleep(15000, signal);
      return callMistral(system, userMsg, maxTokens, signal, attempt + 1);
    }
    throw Object.assign(new Error('cota_esgotada'), { cotaEsgotada: true });
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('API Key da Mistral inválida. Verifique em console.mistral.ai');
    throw new Error(`Mistral: ${e?.message || 'HTTP ' + res.status}`);
  }

  const d   = await res.json();
  const txt = d?.choices?.[0]?.message?.content?.trim();
  if (!txt) throw new Error('Resposta vazia da Mistral.');
  return txt;
}

// ─────────────────────────────────────────────────────────────
// ROTEADOR DE AGENTES
// ─────────────────────────────────────────────────────────────
/**
 * Roteia a chamada para o agente correto com fallback automático.
 *
 * Regra:
 *  • A1 = Mistral (primário) → fallback Gemini
 *  • A2 = Gemini  (primário) → fallback Mistral
 *  • A3 = Gemini  (primário) → fallback Mistral
 *
 * @param {string}      system
 * @param {string}      userMsg
 * @param {number}      maxTokens
 * @param {AbortSignal} signal
 * @param {1|2|3}       agentNum
 */
export async function callAgent(system, userMsg, maxTokens, signal, agentNum) {
  const mistralOk = _getMistralKey().length > 20;
  const geminiOk  = _getGeminiKey().startsWith('AIza') && _getGeminiKey().length > 20;

  const tryFallback = async (skipApi, label) => {
    if (skipApi !== 'mistral' && mistralOk) {
      PipelineUI.log(`⚠ ${label} — usando Mistral como fallback...`, 'w');
      try { return await callMistral(system, userMsg, maxTokens, signal); }
      catch (e2) {
        if (!e2.cotaEsgotada) throw e2;
        PipelineUI.log('⚠ Mistral também indisponível no fallback.', 'w');
      }
    }
    if (skipApi !== 'gemini' && geminiOk) {
      PipelineUI.log(`⚠ ${label} — usando Gemini como fallback...`, 'w');
      return callGemini(system, userMsg, maxTokens, 1, signal);
    }
    throw new Error(`Todas as APIs falharam no A${agentNum}. Verifique suas chaves e cotas.`);
  };

  // ── A1: Mistral primário ──
  if (agentNum === 1) {
    if (!mistralOk) {
      PipelineUI.log('⚠ Mistral não configurada no A1 — usando Gemini como fallback...', 'w');
      return tryFallback('mistral', 'A1 sem Mistral');
    }
    try { return await callMistral(system, userMsg, maxTokens, signal); }
    catch (err) {
      if (err.cotaEsgotada) return tryFallback('mistral', 'Mistral indisponível no A1');
      throw err;
    }
  }

  // ── A2 e A3: Gemini primário ──
  if (!geminiOk) {
    PipelineUI.log(`⚠ Gemini não configurada no A${agentNum} — usando Mistral como fallback...`, 'w');
    return tryFallback('gemini', `A${agentNum} sem Gemini`);
  }
  try { return await callGemini(system, userMsg, maxTokens, 1, signal); }
  catch (err) {
    if (err.cotaEsgotada) return tryFallback('gemini', `Gemini indisponível no A${agentNum}`);
    throw err;
  }
}
