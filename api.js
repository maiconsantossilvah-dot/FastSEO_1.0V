/**
 * services/api.js
 * ───────────────
 * Camada de serviço para chamadas às APIs de IA.
 * Gemini (A2, A3) e Mistral (A1) ficam aqui.
 *
 * ⚠️ As chaves são lidas do DOM (inseridas pelo usuário)
 *    e nunca hardcoded. Ver config.js para contexto de segurança.
 *
 * ✅ MULTI-KEY FALLBACK:
 *    Suporta múltiplas chaves para Gemini e Mistral.
 *    Em caso de 503, 529 ou sobrecarga (overloaded), o sistema
 *    roteia automaticamente para a próxima chave disponível.
 */

import { GEMINI_DEFAULT_MODEL, MISTRAL_MODEL } from './config.js';
import { PipelineUI } from './PipelineUI.js';

// ─── Erros que justificam troca de chave ────────────────────
// 429 = rate limit por minuto → aguarda e retenta na MESMA chave
// 503 = serviço indisponível   → troca de chave imediatamente
// 529 = sobrecarga (overloaded)→ troca de chave imediatamente
const OVERLOAD_CODES  = new Set([503, 529]);
const OVERLOAD_PHRASES = /overloaded|service.?unavailable|backend.?error|capacity|too many/i;

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

function _getModel() {
  return document.getElementById('modelSel')?.value || GEMINI_DEFAULT_MODEL;
}

// ─── Leitura de chaves (primária + secundárias) ──────────────
/**
 * Retorna lista ordenada de chaves Gemini válidas.
 * Primária: #apiKey  |  Secundária: #apiKey2  |  Terciária: #apiKey3
 */
function _getGeminiKeys() {
  return [
    document.getElementById('apiKey')?.value.trim()  || '',
    document.getElementById('apiKey2')?.value.trim() || '',
    document.getElementById('apiKey3')?.value.trim() || '',
  ].filter(k => k.startsWith('AIza') && k.length > 20);
}

/**
 * Retorna lista ordenada de chaves Mistral válidas.
 * Primária: #mistralKey  |  Secundária: #mistralKey2
 */
function _getMistralKeys() {
  return [
    document.getElementById('mistralKey')?.value.trim()  || '',
    document.getElementById('mistralKey2')?.value.trim() || '',
  ].filter(k => k.length > 20);
}

// Compat: funções de chave única usadas internamente
function _getGeminiKey()  { return _getGeminiKeys()[0]  || ''; }
function _getMistralKey() { return _getMistralKeys()[0] || ''; }

// ─────────────────────────────────────────────────────────────
// GEMINI — chamada com suporte a múltiplas chaves
// ─────────────────────────────────────────────────────────────
/**
 * Tenta chamar o Gemini com cada chave disponível em sequência.
 * 429 → aguarda e retenta na mesma chave (até 3x)
 * 503/529/overloaded → troca imediatamente para próxima chave
 */
export async function callGemini(system, userMsg, maxTokens, attempt = 1, signal = null) {
  const keys = _getGeminiKeys();
  if (keys.length === 0) {
    throw new Error('Nenhuma API Key do Gemini configurada.');
  }

  let lastErr = null;

  for (let ki = 0; ki < keys.length; ki++) {
    const key        = keys[ki];
    const keyLabel   = ki === 0 ? 'primária' : ki === 1 ? 'secundária' : 'terciária';
    let   retryCount = 0;

    while (retryCount < 3) {
      const model = _getModel();
      const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: userMsg }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
          }),
        });
      } catch (fetchErr) {
        // Erro de rede (não HTTP) — tenta próxima chave
        lastErr = fetchErr;
        if (ki < keys.length - 1) {
          PipelineUI.log(`⚠ Gemini (chave ${keyLabel}): erro de rede — tentando chave ${ki === 0 ? 'secundária' : 'terciária'}...`, 'w');
        }
        break; // sai do while, vai pro próximo ki
      }

      // ── 429: rate limit por minuto → retenta na mesma chave ──
      if (res.status === 429) {
        const e   = await res.json().catch(() => ({}));
        const msg = e?.error?.message || '';
        if (/quota|daily|resource_exhausted|exhausted/i.test(msg)) {
          // Cota diária esgotada — marca e tenta próxima chave
          lastErr = Object.assign(new Error('cota_esgotada'), { cotaEsgotada: true });
          if (ki < keys.length - 1) {
            PipelineUI.log(`⚠ Gemini (chave ${keyLabel}): cota diária esgotada — tentando chave ${ki === 0 ? 'secundária' : 'terciária'}...`, 'w');
          }
          break; // próxima chave
        }
        // Rate limit por minuto
        retryCount++;
        const wait = retryCount * 15;
        PipelineUI.log(`⏳ Limite por minuto (Gemini chave ${keyLabel}). Aguardando ${wait}s...`, 'w');
        await _sleep(wait * 1000, signal);
        continue; // retenta na mesma chave
      }

      // ── 503 / 529 / overloaded → troca de chave imediatamente ──
      if (OVERLOAD_CODES.has(res.status)) {
        const e   = await res.json().catch(() => ({}));
        const msg = e?.error?.message || `HTTP ${res.status}`;
        lastErr   = new Error(`Gemini sobrecarga: ${msg}`);
        if (ki < keys.length - 1) {
          PipelineUI.log(`⚠ Gemini (chave ${keyLabel}): ${res.status} sobrecarga — alternando para chave ${ki === 0 ? 'secundária' : 'terciária'}...`, 'w');
        } else {
          PipelineUI.log(`⚠ Gemini: todas as chaves retornaram sobrecarga (${res.status}).`, 'w');
        }
        break; // próxima chave
      }

      // ── Outros erros HTTP ──
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        const serverMsg = e?.error?.message || '';

        // Verifica padrão overloaded no corpo mesmo sem status 503
        if (OVERLOAD_PHRASES.test(serverMsg)) {
          lastErr = new Error(`Gemini sobrecarga: ${serverMsg}`);
          if (ki < keys.length - 1) {
            PipelineUI.log(`⚠ Gemini (chave ${keyLabel}): sobrecarga detectada — alternando para chave ${ki === 0 ? 'secundária' : 'terciária'}...`, 'w');
          }
          break; // próxima chave
        }

        if (res.status === 400) {
          throw new Error(`API Key do Gemini (${keyLabel}) inválida. Verifique em aistudio.google.com`);
        }
        throw new Error(`Gemini: ${serverMsg || 'HTTP ' + res.status}`);
      }

      // ── Sucesso ──
      const d   = await res.json();
      const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!txt) throw new Error('Resposta vazia do Gemini.');

      if (ki > 0) {
        PipelineUI.log(`✓ Gemini respondeu via chave ${keyLabel}.`, 'o');
      }
      return txt;
    }
  }

  // Todas as chaves falharam
  if (lastErr?.cotaEsgotada) {
    throw Object.assign(new Error('cota_esgotada'), { cotaEsgotada: true });
  }
  throw lastErr || new Error('Gemini: todas as chaves disponíveis falharam.');
}

// ─────────────────────────────────────────────────────────────
// MISTRAL — chamada com suporte a múltiplas chaves
// ─────────────────────────────────────────────────────────────
/**
 * Tenta chamar o Mistral com cada chave disponível em sequência.
 * 429 → aguarda e retenta na mesma chave (1x)
 * 503/529/overloaded → troca imediatamente para próxima chave
 */
export async function callMistral(system, userMsg, maxTokens, signal = null, attempt = 0) {
  const keys = _getMistralKeys();
  if (keys.length === 0) {
    throw new Error('API Key da Mistral não configurada.');
  }

  let lastErr = null;

  for (let ki = 0; ki < keys.length; ki++) {
    const key      = keys[ki];
    const keyLabel = ki === 0 ? 'primária' : 'secundária';
    let   retried  = false;

    while (true) {
      let res;
      try {
        res = await fetch('https://api.mistral.ai/v1/chat/completions', {
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
      } catch (fetchErr) {
        lastErr = fetchErr;
        if (ki < keys.length - 1) {
          PipelineUI.log(`⚠ Mistral (chave ${keyLabel}): erro de rede — tentando chave secundária...`, 'w');
        }
        break;
      }

      // ── 429: rate limit → retenta 1x na mesma chave, depois próxima ──
      if (res.status === 429) {
        if (!retried) {
          retried = true;
          PipelineUI.log(`⏳ Limite por minuto (Mistral chave ${keyLabel}). Aguardando 15s...`, 'w');
          await _sleep(15000, signal);
          continue;
        }
        lastErr = Object.assign(new Error('cota_esgotada'), { cotaEsgotada: true });
        if (ki < keys.length - 1) {
          PipelineUI.log(`⚠ Mistral (chave ${keyLabel}): cota esgotada — tentando chave secundária...`, 'w');
        }
        break;
      }

      // ── 503 / 529 / sobrecarga → próxima chave ──
      if (OVERLOAD_CODES.has(res.status)) {
        const e   = await res.json().catch(() => ({}));
        const msg = e?.message || `HTTP ${res.status}`;
        lastErr   = new Error(`Mistral sobrecarga: ${msg}`);
        if (ki < keys.length - 1) {
          PipelineUI.log(`⚠ Mistral (chave ${keyLabel}): ${res.status} sobrecarga — alternando para chave secundária...`, 'w');
        } else {
          PipelineUI.log(`⚠ Mistral: todas as chaves retornaram sobrecarga.`, 'w');
        }
        break;
      }

      // ── Outros erros HTTP ──
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        const serverMsg = e?.message || '';

        if (OVERLOAD_PHRASES.test(serverMsg)) {
          lastErr = new Error(`Mistral sobrecarga: ${serverMsg}`);
          if (ki < keys.length - 1) {
            PipelineUI.log(`⚠ Mistral (chave ${keyLabel}): sobrecarga — alternando para chave secundária...`, 'w');
          }
          break;
        }

        if (res.status === 401) {
          throw new Error(`API Key da Mistral (${keyLabel}) inválida. Verifique em console.mistral.ai`);
        }
        throw new Error(`Mistral: ${serverMsg || 'HTTP ' + res.status}`);
      }

      // ── Sucesso ──
      const d   = await res.json();
      const txt = d?.choices?.[0]?.message?.content?.trim();
      if (!txt) throw new Error('Resposta vazia da Mistral.');

      if (ki > 0) {
        PipelineUI.log(`✓ Mistral respondeu via chave secundária.`, 'o');
      }
      return txt;
    }
  }

  if (lastErr?.cotaEsgotada) {
    throw Object.assign(new Error('cota_esgotada'), { cotaEsgotada: true });
  }
  throw lastErr || new Error('Mistral: todas as chaves disponíveis falharam.');
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
 * Dentro de cada API, o sistema tenta automaticamente todas as
 * chaves cadastradas (primária → secundária → terciária).
 *
 * @param {string}      system
 * @param {string}      userMsg
 * @param {number}      maxTokens
 * @param {AbortSignal} signal
 * @param {1|2|3}       agentNum
 */
export async function callAgent(system, userMsg, maxTokens, signal, agentNum) {
  const mistralOk = _getMistralKeys().length > 0;
  const geminiOk  = _getGeminiKeys().length  > 0;

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

// ─── Exporta helpers de leitura de chaves para uso no ConfigUI ──
export { _getGeminiKeys, _getMistralKeys };
