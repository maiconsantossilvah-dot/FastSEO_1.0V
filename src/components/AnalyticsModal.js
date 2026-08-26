import { UsageAnalytics } from '../services/usageAnalytics.js';
import { UserAccess } from '../services/userAccess.js';
import { escapeHtml } from '../utils/html.js';

const $ = id => document.getElementById(id);
const number = value => Number(value || 0).toLocaleString('pt-BR');
const percent = value => `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const duration = value => value ? `${(Number(value) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s` : '—';

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function period(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: isoDate(from), to: isoDate(to) };
}

function card(value, label, tone = '') {
  return `<article class="usage-summary-card${tone ? ` usage-summary-card--${tone}` : ''}">
    <strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span>
  </article>`;
}

function emptyRow(columns, text) {
  return `<tr><td colspan="${columns}" class="usage-table-empty">${escapeHtml(text)}</td></tr>`;
}

function renderDailyChart(items) {
  if (!items.length) return '<div class="usage-empty-inline">Sem dados neste período.</div>';
  const max = Math.max(...items.map(item => Number(item.totalTokens || 0)), 1);
  return `<div class="usage-chart" role="img" aria-label="Evolução diária de tokens">
    ${items.map((item, index) => {
      const height = Math.max(4, Math.round((Number(item.totalTokens || 0) / max) * 100));
      const showLabel = items.length <= 14 || index === 0 || index === items.length - 1 || index % Math.ceil(items.length / 8) === 0;
      return `<div class="usage-chart-day" title="${escapeHtml(item.date)}: ${number(item.totalTokens)} tokens">
        <span class="usage-chart-value">${number(item.totalTokens)}</span>
        <span class="usage-chart-bar" style="height:${height}%"></span>
        <span class="usage-chart-label">${showLabel ? escapeHtml(item.date.slice(5).replace('-', '/')) : ''}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function renderData(data) {
  const summary = data.summary || {};
  const users = data.users || [];
  const stages = data.stages || [];
  const providers = data.providers || [];
  const categories = data.categories || [];

  return `
    ${data.truncated ? '<div class="usage-notice">O período atingiu o limite de 10.000 execuções. Reduza o intervalo para ver todos os registros.</div>' : ''}
    <section class="usage-summary-grid" aria-label="Resumo do período">
      ${card(number(summary.runs), 'Fichas processadas')}
      ${card(number(summary.averageTokensPerRun), 'Média de tokens por ficha', 'primary')}
      ${card(number(summary.inputTokens), 'Tokens de entrada')}
      ${card(number(summary.outputTokens), 'Tokens de saída')}
      ${card(number(summary.totalTokens), 'Tokens totais', 'primary')}
      ${card(percent(summary.approvalRate), 'Taxa de aprovação', 'success')}
      ${card(number(summary.requests), 'Chamadas às IAs')}
      ${card(duration(summary.averageDurationMs), 'Tempo médio')}
    </section>

    <section class="usage-panel">
      <div class="usage-panel-heading"><div><span>Evolução diária</span><small>Tokens totais por dia</small></div></div>
      ${renderDailyChart(data.daily || [])}
    </section>

    <section class="usage-panel">
      <div class="usage-panel-heading"><div><span>Consumo por usuário</span><small>As chaves continuam individuais; apenas o uso é consolidado</small></div></div>
      <div class="usage-table-wrap"><table class="usage-table">
        <thead><tr><th>Usuário</th><th>Fichas</th><th>Média/ficha</th><th>Entrada</th><th>Saída</th><th>Total</th><th>Aprovação</th></tr></thead>
        <tbody>${users.length ? users.map(user => `<tr>
          <td><strong>${escapeHtml(user.displayName || 'Sem nome')}</strong><small>${escapeHtml(user.email)}</small></td>
          <td>${number(user.runs)}</td><td>${number(user.averageTokensPerRun)}</td><td>${number(user.inputTokens)}</td>
          <td>${number(user.outputTokens)}</td><td><strong>${number(user.totalTokens)}</strong></td><td>${percent(user.approvalRate)}</td>
        </tr>`).join('') : emptyRow(7, 'Nenhum usuário com uso no período.')}</tbody>
      </table></div>
    </section>

    <div class="usage-split-grid">
      <section class="usage-panel">
        <div class="usage-panel-heading"><div><span>Por agente</span><small>A1, A2 e A3</small></div></div>
        <div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>Agente</th><th>Chamadas</th><th>Média</th><th>Total</th></tr></thead>
          <tbody>${stages.length ? stages.map(stage => `<tr><td><strong>${escapeHtml(stage.label)}</strong></td><td>${number(stage.requests)}</td><td>${number(stage.averageTokensPerRequest)}</td><td>${number(stage.totalTokens)}</td></tr>`).join('') : emptyRow(4, 'Sem dados por agente.')}</tbody>
        </table></div>
      </section>
      <section class="usage-panel">
        <div class="usage-panel-heading"><div><span>Por modelo</span><small>Provedor e modelo utilizado</small></div></div>
        <div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>Modelo</th><th>Chamadas</th><th>Média</th><th>Total</th></tr></thead>
          <tbody>${providers.length ? providers.map(item => `<tr><td><strong>${escapeHtml(item.model)}</strong><small>${escapeHtml(item.provider)}</small></td><td>${number(item.requests)}</td><td>${number(item.averageTokensPerRequest)}</td><td>${number(item.totalTokens)}</td></tr>`).join('') : emptyRow(4, 'Sem dados por modelo.')}</tbody>
        </table></div>
      </section>
    </div>

    <section class="usage-panel">
      <div class="usage-panel-heading"><div><span>Por categoria</span><small>Onde estão as fichas com maior consumo</small></div></div>
      <div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>Categoria</th><th>Fichas</th><th>Média/ficha</th><th>Entrada</th><th>Saída</th><th>Total</th></tr></thead>
        <tbody>${categories.length ? categories.map(item => `<tr><td><strong>${escapeHtml(item.category)}</strong></td><td>${number(item.runs)}</td><td>${number(item.averageTokensPerRun)}</td><td>${number(item.inputTokens)}</td><td>${number(item.outputTokens)}</td><td>${number(item.totalTokens)}</td></tr>`).join('') : emptyRow(6, 'Sem categorias no período.')}</tbody>
      </table></div>
    </section>`;
}

export const AnalyticsModal = {
  requestRevision: 0,
  range: period(30),

  open() {
    if (!UserAccess.can('viewUsageAnalytics') || $('analyticsOverlay')) return;
    this.range = period(30);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay--prompt';
    overlay.id = 'analyticsOverlay';
    overlay.innerHTML = `
      <div class="modal modal--analytics" role="dialog" aria-modal="true" aria-labelledby="analyticsTitle">
        <div class="modal-hdr">
          <span class="modal-title" id="analyticsTitle"><i data-lucide="chart-no-axes-combined" aria-hidden="true"></i> Analytics de uso</span>
          <span class="usage-admin-badge"><i data-lucide="shield-check" aria-hidden="true"></i> Admin</span>
          <button class="modal-close" id="analyticsCloseBtn" type="button" aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button>
        </div>
        <div class="usage-toolbar">
          <div class="usage-periods" aria-label="Período">
            <button class="usage-period" data-days="7" type="button">7 dias</button>
            <button class="usage-period is-active" data-days="30" type="button">30 dias</button>
            <button class="usage-period" data-days="90" type="button">90 dias</button>
          </div>
          <label>De <input type="date" id="usageDateFrom" value="${this.range.from}"></label>
          <label>Até <input type="date" id="usageDateTo" value="${this.range.to}"></label>
          <button class="btn btn-secondary" id="usageApplyRange" type="button"><i data-lucide="search" aria-hidden="true"></i> Aplicar</button>
        </div>
        <div class="modal-body usage-modal-body" id="usageAnalyticsBody">
          <div class="usage-loading"><span class="loading-spinner" aria-hidden="true"></span><strong>Carregando uso da equipe...</strong><small>O backend gratuito pode levar alguns segundos para iniciar.</small></div>
        </div>
        <div class="modal-ftr usage-modal-footer"><span>Somente métricas técnicas — sem chaves, prompts ou fichas.</span><button class="btn btn-primary" id="analyticsCloseBtnFtr" type="button">Fechar</button></div>
      </div>`;
    document.body.appendChild(overlay);
    this.refreshIcons();
    overlay.addEventListener('click', event => { if (event.target === overlay) this.close(); });
    $('analyticsCloseBtn')?.addEventListener('click', () => this.close());
    $('analyticsCloseBtnFtr')?.addEventListener('click', () => this.close());
    overlay.querySelectorAll('[data-days]').forEach(button => button.addEventListener('click', () => {
      overlay.querySelectorAll('[data-days]').forEach(item => item.classList.remove('is-active'));
      button.classList.add('is-active');
      this.range = period(Number(button.dataset.days));
      $('usageDateFrom').value = this.range.from;
      $('usageDateTo').value = this.range.to;
      this.load();
    }));
    $('usageApplyRange')?.addEventListener('click', () => {
      this.range = { from: $('usageDateFrom').value, to: $('usageDateTo').value };
      overlay.querySelectorAll('[data-days]').forEach(item => item.classList.remove('is-active'));
      this.load();
    });
    const escHandler = event => { if (event.key === 'Escape') this.close(); };
    document.addEventListener('keydown', escHandler);
    overlay._escHandler = escHandler;
    this.load();
  },

  async load() {
    const body = $('usageAnalyticsBody');
    if (!body) return;
    if (!this.range.from || !this.range.to || this.range.from > this.range.to) {
      body.innerHTML = '<div class="usage-error"><strong>Período inválido</strong><span>Escolha uma data inicial anterior à data final.</span></div>';
      return;
    }
    const revision = ++this.requestRevision;
    body.innerHTML = '<div class="usage-loading"><span class="loading-spinner" aria-hidden="true"></span><strong>Atualizando métricas...</strong><small>Consolidando o uso de todos os usuários.</small></div>';
    try {
      const data = await UsageAnalytics.getAnalytics(this.range);
      if (revision !== this.requestRevision || !$('usageAnalyticsBody')) return;
      body.innerHTML = Number(data.summary?.runs || 0)
        ? renderData(data)
        : '<div class="ui-empty-state"><i data-lucide="chart-no-axes-combined" aria-hidden="true"></i><strong>Nenhum uso neste período</strong><p>Quando a equipe processar fichas, os dados aparecerão aqui automaticamente.</p></div>';
      this.refreshIcons();
    } catch (error) {
      if (revision !== this.requestRevision || !$('usageAnalyticsBody')) return;
      body.innerHTML = `<div class="usage-error"><i data-lucide="triangle-alert" aria-hidden="true"></i><strong>Não foi possível carregar o analytics</strong><span>${escapeHtml(error.message)}</span><button class="btn btn-secondary" id="usageRetryBtn" type="button">Tentar novamente</button></div>`;
      $('usageRetryBtn')?.addEventListener('click', () => this.load());
      this.refreshIcons();
    }
  },

  refreshIcons() {
    window.lucide?.createIcons?.({ attrs: { 'aria-hidden': 'true', focusable: 'false' } });
  },

  close() {
    this.requestRevision += 1;
    const overlay = $('analyticsOverlay');
    if (overlay?._escHandler) document.removeEventListener('keydown', overlay._escHandler);
    overlay?.remove();
  },
};
