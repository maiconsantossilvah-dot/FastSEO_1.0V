/**
 * components/HistoryUI.js
 */
import { History }    from './history.js';
import { AppState }   from './state.js';
import { PipelineUI } from './PipelineUI.js';
import { Utils }      from './index.js';

const $ = id => document.getElementById(id);

export const HistoryUI = {
  render() {
    const container = $('historicoLista');
    if (!container) return;
    const busca  = ($('historicoBusca')?.value  || '').toLowerCase().trim();
    const filtro = $('historicoFiltro')?.value  || 'todos';
    const todos  = History.getAll();
    let items    = [...todos];
    if (filtro === 'bivolt') items = items.filter(i => i.bivolt);
    if (filtro === 'padrao') items = items.filter(i => !i.bivolt);
    if (busca)  items = items.filter(i => (i.preview||'').toLowerCase().includes(busca)||(i.data||'').toLowerCase().includes(busca));

    if (!items.length) {
      container.innerHTML = `<p style="color:var(--color-text-muted);font-size:12px;text-align:center;padding:16px 0">${busca||filtro!=='todos'?'Nenhum resultado encontrado para o filtro aplicado.':'Nenhum resultado salvo ainda.'}</p>`;
      return;
    }
    container.innerHTML = items.map(item => `
      <div class="hist-item" data-id="${Utils.escHtml(String(item.id||''))}">
        <div class="hist-meta">
          <span class="hist-date">${Utils.escHtml(item.data||'')}</span>
          ${item.bivolt?'<span class="hist-bivolt-tag">BIVOLT</span>':''}
        </div>
        <div class="hist-preview">${Utils.escHtml(item.preview||'(sem preview)')}</div>
      </div>`).join('');

    container.querySelectorAll('.hist-item').forEach(el => {
      el.addEventListener('click', () => {
        const item = todos.find(t => String(t.id) === el.dataset.id);
        if (item) this._restore(item);
      });
    });
  },

  _restore(item) {
    AppState.pipeline.result = { ficha:item.ficha, conteudo:item.conteudo, bivolt:item.bivolt };
    PipelineUI.showResults(item.ficha, '', item.conteudo, item.bivolt, false);
    const vo = $('validacaoOut'); if (vo) vo.textContent = '';
    $('historicoPanel')?.scrollIntoView({ behavior:'smooth', block:'nearest' });
    PipelineUI.log(`📂 Resultado de ${item.data} restaurado.`, 'o');
  },
};
