/**
 * components/AnalyticsModal.js
 */
import { Logs } from './quota.js';

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
      : `<p style="text-align:center;color:var(--color-text-muted);font-size:13px;padding:20px 0">Nenhum processamento registrado ainda.<br>Execute o pipeline para ver as métricas.</p>`;

    overlay.innerHTML = `
      <div class="modal" style="max-width:480px">
        <div class="modal-hdr"><span class="modal-title">📊 Analytics de uso</span><button class="modal-close" id="analyticsCloseBtn">✕</button></div>
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
    $('clearLogsBtn')?.addEventListener('mouseover', e => e.target.style.color='var(--color-danger)');
    $('clearLogsBtn')?.addEventListener('mouseout',  e => e.target.style.color='var(--color-text-muted)');
  },
  close() {
    const o = $('analyticsOverlay');
    if (o?._escHandler) document.removeEventListener('keydown', o._escHandler);
    o?.remove();
  },
};
