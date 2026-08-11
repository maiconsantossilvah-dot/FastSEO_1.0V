/**
 * modules/TextReader.js
 * ---------------------
 * Lê arquivos .txt no navegador e envia o conteúdo para o input principal.
 */

import { PipelineUI } from '../components/PipelineUI.js';
import { Utils }      from '../utils/index.js';
import { APP_CONFIG } from '../config.js';
import { AppState }   from './state.js';

function decodeBuffer(buffer) {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }

  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }

  const content = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF
    ? bytes.subarray(3)
    : bytes;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    return new TextDecoder('windows-1252').decode(content);
  }
}

function cleanText(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function sendToInput(text) {
  const input = document.getElementById('inputText');
  if (input) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  AppState.pdfTexto = '';
  AppState.inputSource = 'text';
}

export const TextReader = {
  async extractText(file) {
    const buffer = await file.arrayBuffer();
    return cleanText(decodeBuffer(buffer));
  },

  async process(file) {
    try {
      PipelineUI.log(`Lendo arquivo de texto: ${file.name}`, 'i');
      const text = await TextReader.extractText(file);

      if (!text) {
        PipelineUI.log('Arquivo TXT vazio.', 'w');
        Utils.showToast('Arquivo TXT vazio', '#D97706');
        return false;
      }

      sendToInput(text);

      const chars = text.length.toLocaleString('pt-BR');
      PipelineUI.log(`Arquivo TXT carregado: ${chars} caracteres, ${file.name}`, 'o');

      if (text.length > APP_CONFIG.inputMaxChars) {
        PipelineUI.log(`Arquivo grande: ${chars} caracteres no input.`, 'w');
        Utils.showToast('TXT carregado; o texto excede o limite do agente', '#D97706');
      } else {
        Utils.showToast(`TXT carregado - ${chars} chars`);
      }

      return true;
    } catch (err) {
      PipelineUI.log(`Erro ao ler TXT: ${err.message}`, 'e');
      Utils.showToast('Erro ao ler o arquivo TXT', '#DC2626');
      console.error('TextReader:', err);
      return false;
    }
  },
};
