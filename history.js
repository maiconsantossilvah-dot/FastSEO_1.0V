/**
 * modules/history.js
 * ───────────────────
 * Histórico de resultados persistido no Firestore.
 * Listener em tempo real mantém a UI sempre atualizada.
 */

import { HistoryDB }   from './firestore.js';
import { HistoryUI }   from './HistoryUI.js';
import { APP_CONFIG }  from './config.js';

// Cache em memória
let _items = [];

export const History = {
  getAll() { return _items; },

  async save(data) {
    await HistoryDB.save(data);
    // O listener em tempo real atualizará _items e re-renderizará
  },

  async clear() {
    await HistoryDB.clearAll();
    // Listener atualiza automaticamente
  },

  startSync() {
    return HistoryDB.listen(items => {
      _items = items.slice(0, APP_CONFIG.historyMaxItems);
      HistoryUI.render();
    });
  },
};
