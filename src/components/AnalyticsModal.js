/**
 * components/AnalyticsModal.js
 */
import { Logs } from '../modules/quota.js';

const $ = id => document.getElementById(id);

export const AnalyticsModal = {
  open() {
    if ($('analyticsOverlay')) return;
    const m = Logs.getMetrics();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay--prompt';
    overlay.id = 'analyticsOverlay';
    const body = m
      ? `<div class="analytics-grid">
          <div class="analytics-card"><div class="analytics-val">${m.total}</div><div class="analytics-lbl">Total processado</div></div>
          <div class="analytics-card"><div class="analytics-val" style="color:var(--color-success)">${m.aprovados}</div><div class="analytics-lbl">Aprovados A2</div></div>
          <div class="analytics-card"><div class="analytics-val" style="color:var(--color-warn)">${m.reprovados}</div><div class="analytics-lbl">Reprovados A2</div></div>
          <div class="analytics-card"><div class="analytics-val" style="color:var(--color-danger)">${m.erros}</div><div class="analytics-lbl">Erros</div></div>
          <div class="analytics-card"><div class="analytics-val" style="color:var(--color-accent)">${m.taxaAprv}%</div><div class="analytics-lbl">Taxa aprovação</div></div>
          <div class="analytics-card"><div class="analytics-val">${m.mediaMs > 0 ? (m.mediaMs/1000).toFixed(1)+'s' : '—'}</div><div class="analytics-lbl">Tempo médio</div></div>
        </div>
        <div style="margin-top:12px;text-align:right">
          <button id="clearLogsBtn" style="font-size:11px;color:var(--color-text-muted);background:none;border:none;cursor:pointer;padding:4px 8px;transition:color .15s">Limpar logs</button>
        </div>`
      : `<div class="ui-empty-state"><i data-lucide="chart-no-axes-combined" aria-hidden="true"></i><strong>Nenhum processamento registrado</strong><p>Execute o pipeline para começar a acompanhar volume, qualidade e tempo médio.</p><button class="btn btn-primary" id="analyticsStartBtn" type="button">Processar primeira ficha</button></div>`;

    overlay.innerHTML = `
      <div class="modal" style="max-width:480px">
        <div class="modal-hdr"><span class="modal-title"><i data-lucide="chart-no-axes-combined" aria-hidden="true"></i> Analytics de uso</span><button class="modal-close" id="analyticsCloseBtn" type="button" aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button></div>
        <div class="modal-body">${body}</div>
        <div class="modal-ftr" style="justify-content:flex-end"><button class="btn btn-primary" id="analyticsCloseBtnFtr">Fechar</button></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    $('analyticsCloseBtn').addEventListener('click',    () => this.close());
    $('analyticsCloseBtnFtr').addEventListener('click', () => this.close());
    const escH = e => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', escH);
    overlay._escHandler = escH;
    $('clearLogsBtn')?.addEventListener('click', () => {
      if (confirm('Apagar todos os logs?')) { Logs.clear(); this.close(); }
    });
    $('analyticsStartBtn')?.addEventListener('click', () => {
      this.close();
      $('showFichaViewBtn')?.click();
      $('inputText')?.focus();
    });
  },
  close() {
    const o = $('analyticsOverlay');
    if (o?._escHandler) document.removeEventListener('keydown', o._escHandler);
    o?.remove();
  },
};
