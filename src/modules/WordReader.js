/**
 * modules/WordReader.js
 * ---------------------
 * Extrai texto de documentos .docx no navegador usando Mammoth.js.
 */

import { PipelineUI } from '../components/PipelineUI.js';
import { Utils }      from '../utils/index.js';
import { APP_CONFIG } from '../config.js';
import { loadExternalScript } from '../utils/loadExternalScript.js';
import { AppState }   from './state.js';

const MAMMOTH_CDN = 'https://unpkg.com/mammoth@1.12.1/mammoth.browser.min.js';
const MAMMOTH_INTEGRITY = 'sha384-HDD+X9TzmVU2HzA3VYqphTtip2QgcmmSAuKTMkFv709AUMZ6LPn0ysDRZeQIL31w';

let loaded = false;

async function loadMammoth() {
  if (loaded || window.mammoth) {
    loaded = true;
    return;
  }

  await loadExternalScript({
    src: MAMMOTH_CDN,
    integrity: MAMMOTH_INTEGRITY,
    globalName: 'mammoth',
    errorMessage: 'Falha ao carregar leitor do Word',
  });
  loaded = true;
}

function cleanText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sendToInput(text) {
  const input = document.getElementById('inputText');
  if (input) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  AppState.pdfTexto = '';
  AppState.inputSource = 'word';
}

export const WordReader = {
  async extractText(file) {
    await loadMammoth();
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });

    return {
      text: cleanText(result.value),
      messages: result.messages || [],
    };
  },

  async process(file) {
    try {
      PipelineUI.log(`Lendo documento Word: ${file.name}`, 'i');
      const { text, messages } = await WordReader.extractText(file);

      if (!text) {
        PipelineUI.log('Documento Word sem texto extraivel.', 'w');
        Utils.showToast('Documento Word sem texto legivel', '#D97706');
        return false;
      }

      sendToInput(text);

      const chars = text.length.toLocaleString('pt-BR');
      PipelineUI.log(`Documento Word extraido: ${chars} caracteres, ${file.name}`, 'o');

      if (messages.length) {
        PipelineUI.log(`Leitura do Word concluida com ${messages.length} aviso(s).`, 'w');
      }

      if (text.length > APP_CONFIG.inputMaxChars) {
        PipelineUI.log(`Documento grande: ${chars} caracteres no input.`, 'w');
        Utils.showToast('Word carregado; o texto excede o limite do agente', '#D97706');
      } else {
        Utils.showToast(`Word carregado - ${chars} chars`);
      }

      return true;
    } catch (err) {
      PipelineUI.log(`Erro ao ler Word: ${err.message}`, 'e');
      Utils.showToast('Erro ao ler o documento Word', '#DC2626');
      console.error('WordReader:', err);
      return false;
    }
  },
};
