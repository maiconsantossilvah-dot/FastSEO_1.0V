/**
 * components/HistoryModal.js
 * ───────────────────────────
 * Modal do histórico de fichas — substitui o painel colapsável da tela principal.
 * Mantém todos os IDs originais para compatibilidade com HistoryUI.js e main.js.
 */

export const HistoryModal = {
  open() {
    if (document.getElementById('historicoModalOverlay')) {
      // Já aberto — só renderizar
      this._triggerRender();
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'historicoModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal--lg modal--hist">
        <div class="modal-hdr">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="modal-title">📂 Histórico de Fichas</span>
            <span id="historicoCountModal" style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(99,102,241,.15);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);display:none"></span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <button id="clearHistoricoBtn" class="btn btn-danger" style="font-size:11px;padding:5px 12px">Limpar tudo</button>
            <button class="modal-close" id="historicoModalClose">✕</button>
          </div>
        </div>
        <div class="modal-body" style="gap:12px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input id="historicoBusca" type="text" placeholder="🔍 Buscar no histórico..."
              style="flex:1;min-width:180px"/>
            <select id="historicoFiltro">
              <option value="todos">Todos</option>
              <option value="padrao">Padrão</option>
              <option value="bivolt">Bivolt</option>
            </select>
          </div>
          <div id="historicoLista" style="display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow-y:auto;padding-right:4px"></div>
        </div>
        <div class="modal-ftr" style="justify-content:flex-end">
          <button class="btn btn-primary" id="historicoModalClose2">Fechar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Eventos de busca/filtro — elementos já existem no DOM após appendChild
    document.getElementById('historicoBusca')?.addEventListener('input', () => {
      import('./HistoryUI.js').then(({ HistoryUI }) => { HistoryUI.resetPage(); HistoryUI.render(); });
    });
    document.getElementById('historicoFiltro')?.addEventListener('change', () => {
      import('./HistoryUI.js').then(({ HistoryUI }) => { HistoryUI.resetPage(); HistoryUI.render(); });
    });

    const close = () => this.close();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#historicoModalClose')?.addEventListener('click', close);
    overlay.querySelector('#historicoModalClose2')?.addEventListener('click', close);
    document.addEventListener('keydown', this._esc);

    // Renderizar imediatamente via HistoryUI (que tem acesso ao cache do History)
    import('./HistoryUI.js').then(({ HistoryUI }) => { HistoryUI.resetPage(); HistoryUI.render(); });
  },

  _triggerRender() {
    import('./HistoryUI.js').then(({ HistoryUI }) => HistoryUI.render()).catch(() => {});
  },

  updateCount(n) {
    // Atualiza badge no header e dentro do modal
    ['historicoCount', 'historicoCountModal'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (n > 0) { el.textContent = n; el.style.display = ''; }
      else { el.style.display = 'none'; }
    });
  },

  close() {
    document.getElementById('historicoModalOverlay')?.remove();
    document.removeEventListener('keydown', this._esc);
  },

  _esc(e) { if (e.key === 'Escape') HistoryModal.close(); },

  // Compatibilidade com HistoryUI.toggle() e HistoryUI.resetPage()
  toggle() { 
    if (document.getElementById('historicoModalOverlay')) this.close();
    else this.open();
  },
  resetPage() {},
};
