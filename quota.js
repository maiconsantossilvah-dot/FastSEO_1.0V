/**
 * modules/quota.js
 * ─────────────────
 * Controle de cota diária de requisições.
 * Persiste no localStorage (por usuário, por dispositivo).
 */

const LS_USO = 'gemini_uso';

export const Quota = {
  today() { return new Date().toISOString().slice(0, 10); },

  getUsage() {
    try {
      const obj = JSON.parse(localStorage.getItem(LS_USO) || 'null');
      if (!obj || typeof obj.count !== 'number' || obj.data !== this.today()) {
        return { data: this.today(), count: 0 };
      }
      return obj;
    } catch { return { data: this.today(), count: 0 }; }
  },

  add(n) {
    const uso = this.getUsage();
    uso.count += n;
    localStorage.setItem(LS_USO, JSON.stringify(uso));
    this.updateUI();
  },

  reset() {
    localStorage.removeItem(LS_USO);
    this.updateUI();
  },

  getLimit() {
    const m = document.getElementById('modelSel')?.value || '';
    if (m.includes('2.5-pro'))    return 100;
    if (m.includes('flash-lite')) return 1000;
    return 250;
  },

  updateUI() {
    const uso = this.getUsage(), lim = this.getLimit();
    const pct = Math.min(100, (uso.count / lim) * 100);
    const label = document.getElementById('quotaLabel');
    const fill  = document.getElementById('quotaFill');
    if (label) label.textContent = `${uso.count} / ${lim} hoje`;
    if (fill) {
      fill.style.width      = pct + '%';
      fill.style.background = pct > 80 ? 'var(--color-warn)' : 'var(--color-success)';
    }
  },
};

// ─────────────────────────────────────────────────────────────

/**
 * modules/logs.js
 * ────────────────
 * Logs de execução e métricas de pipeline.
 * Armazenados no localStorage (não sincronizados — são locais por design).
 */

const LS_LOGS = 'fastseo_logs';

export const Logs = {
  async save(data) {
    try {
      const logs = JSON.parse(localStorage.getItem(LS_LOGS) || '[]');
      logs.unshift({ ts: new Date().toISOString(), ...data });
      localStorage.setItem(LS_LOGS, JSON.stringify(logs.slice(0, 300)));
    } catch (e) { console.warn('Erro ao salvar log:', e); }
  },

  getAll() {
    try { return JSON.parse(localStorage.getItem(LS_LOGS) || '[]'); }
    catch { return []; }
  },

  getMetrics() {
    const logs      = this.getAll();
    if (!logs.length) return null;
    const aprovados  = logs.filter(l => l.status === 'aprovado').length;
    const reprovados = logs.filter(l => l.status === 'reprovado').length;
    const erros      = logs.filter(l => l.status === 'erro').length;
    const total      = aprovados + reprovados + erros;
    const duracoes   = logs.filter(l => l.duracao_ms).map(l => l.duracao_ms);
    const mediaMs    = duracoes.length
      ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
      : 0;
    const taxaAprv   = total
      ? Math.round((aprovados / (aprovados + reprovados || 1)) * 100)
      : 0;
    return { total, aprovados, reprovados, erros, mediaMs, taxaAprv };
  },

  clear() { localStorage.removeItem(LS_LOGS); },
};
