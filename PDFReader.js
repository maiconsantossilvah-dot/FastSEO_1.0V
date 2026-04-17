/**
 * modules/PDFReader.js
 * ─────────────────────
 * Lê PDFs de fichas técnicas de fornecedores e extrai o texto
 * para o #inputText — sem backend, 100% client-side via PDF.js.
 *
 * Uso: PDFReader.open() — abre seletor de arquivo
 */

import { PipelineUI } from './PipelineUI.js';
import { Utils }      from './index.js';

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let _loaded = false;

async function _loadPdfJs() {
  if (_loaded || window.pdfjsLib) { _loaded = true; return; }
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS_CDN;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
      _loaded = true;
      res();
    };
    s.onerror = () => rej(new Error('Falha ao carregar PDF.js'));
    document.head.appendChild(s);
  });
}

async function _extractText(file) {
  await _loadPdfJs();

  const buffer   = await file.arrayBuffer();
  const pdf      = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const parts    = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Agrupa itens por linha (mesma posição Y aproximada)
    const lines = {};
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lines[y]) lines[y] = [];
      lines[y].push({ x: item.transform[4], text: item.str });
    }

    // Ordena por Y decrescente (topo → baixo) e X crescente dentro de cada linha
    const sorted = Object.entries(lines)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([, items]) =>
        items.sort((a, b) => a.x - b.x).map(i => i.text).join(' ')
      );

    parts.push(`── Página ${i} ──`);
    parts.push(...sorted);
    parts.push('');
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const PDFReader = {
  open() {
    // Cria input file invisível e aciona
    let input = document.getElementById('_pdfInput');
    if (!input) {
      input = document.createElement('input');
      input.type   = 'file';
      input.accept = '.pdf,application/pdf';
      input.id     = '_pdfInput';
      input.style.cssText = 'display:none;position:fixed;left:-9999px';
      document.body.appendChild(input);
    }

    // Limpar listener anterior
    const fresh = input.cloneNode();
    input.replaceWith(fresh);
    fresh.id = '_pdfInput';

    fresh.addEventListener('change', async () => {
      const file = fresh.files?.[0];
      if (!file) return;
      await PDFReader._process(file);
    });

    fresh.click();
  },

  async _process(file) {
    const btn = document.getElementById('pdfBtn');

    try {
      // Feedback visual
      if (btn) { btn.textContent = '⏳ Lendo...'; btn.disabled = true; }
      PipelineUI.log(`📄 Lendo PDF: ${file.name}`, 'i');

      const text = await _extractText(file);

      if (!text || text.length < 30) {
        PipelineUI.log('⚠ PDF sem texto extraível — pode ser uma imagem escaneada.', 'w');
        Utils.showToast('PDF sem texto legível', '#D97706');
        return;
      }

      // Injeta no textarea
      const ta = document.getElementById('inputText');
      if (ta) {
        ta.value = text;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const chars = text.length.toLocaleString('pt-BR');
      PipelineUI.log(`✓ PDF extraído — ${chars} caracteres, ${file.name}`, 'o');
      Utils.showToast(`PDF carregado — ${chars} chars`);

    } catch (err) {
      PipelineUI.log(`✗ Erro ao ler PDF: ${err.message}`, 'e');
      Utils.showToast('Erro ao ler o PDF', '#DC2626');
      console.error('PDFReader:', err);
    } finally {
      if (btn) { btn.textContent = '📄 PDF'; btn.disabled = false; }
    }
  },

  // Suporte a drag & drop — chama direto com o File
  async drop(file) {
    if (!file?.type?.includes('pdf')) return false;
    await PDFReader._process(file);
    return true;
  },
};
