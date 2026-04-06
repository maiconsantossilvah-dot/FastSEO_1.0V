/**
 * modules/subcategories.js
 * ─────────────────────────
 * Regras de padronização de títulos por subcategoria.
 * Sincronizadas com Firestore; fallback para SUBCAT_RULES embutidas.
 */

import { SubcategoriesDB } from '../firebase/firestore.js';
import { AppState }        from './state.js';

// ─── Regras padrão embutidas (subset reduzido para legibilidade)
// O array completo está no arquivo original. Cole-o aqui integralmente.
export const SUBCAT_RULES_DEFAULT = [
  { nome: "Ar Condicionado", formula: "Ar Condicionado Split 18000 BTUs + marca + Modelo(em caixa alta) + Ciclo + Caracteristicas + Voltagem", ex: "Ar Condicionado Split 36000 BTUs Philco PAC36000CFM5 Frio Cassete 220V" },
  { nome: "Aspirador de Pó", formula: "Produto + Marca + Modelo + Litragem + Potência + outras caracteristicas + Cor + Voltagem", ex: "Aspirador de Pó Britânia ASP1400 Faciclean 1200W Branco 110V" },
  { nome: "Batedeira", formula: "produto + Marca + Modelo (Caixa Alta) + Nº Velocidades + Quantidade Tigelas + Potência + Cor + Voltagem", ex: "Batedeira Britânia Perola Maxx, 4 Velocidades, 1 Tigela, 350W, Vermelho" },
  { nome: "Celulares", formula: "Produto + Marca + Modelo (em caixa alta) + Quantidade de Chips + Cor + Tela + Conectividade + Câm Traseira + Armazenamento", ex: "Celular Multilaser Flip Vita P9020, Dual Chip, Azul, Tela 2.4\", MP3, VGA, 32MB" },
  { nome: "Geladeira/Refrigerador", formula: "Geladeira/Refrigerador + Marca + Litragem + Modelo (em caixa alta) + outras Caracteristicas + Variação", ex: "" },
  { nome: "Impressora", formula: "Impressora Multifuncional + Marca + Modelo (em caixa alta) + Tecnologia + Cor Impressão + Conexão + Cor + Voltagem", ex: "Impressora Multifuncional HP Ink Tank 416 (Z4B55A), Tanque de Tinta, Colorida, Wi-Fi, Preto, Bivolt" },
  { nome: "Liquidificador com Filtro", formula: "produto + Marca + Modelo + Filtro + Material do Copo + Velocidades + Pulsar + Potência + Cor + Voltagem", ex: "Liquidificador Mondial L-1200 Turbo com Filtro Copo de Acrilíco 12 Velocidades + Pulsar 1200W Preto 110V" },
  { nome: "Microondas", formula: "Microondas + Marca + Litragem + Modelo(em caixa alta) + outras Caracteristicas + Variação", ex: "Micro-ondas Brastemp 32 Litros BMS45CBANA Branco 110V" },
  { nome: "Notebook", formula: "Produto + Marca + Modelo (em caixa alta) + Tela + Processador e Série + Tamanho Disco Rígido + Memória RAM + Sistema Operacional + Cor", ex: "Notebook Lenovo IdeaPad 3i-IML, Tela de 15.6\", Intel Core i3-1235U, 1TB, 4GB RAM, Windows 10, Prata" },
  { nome: "Smartphone", formula: "Produto + Marca + Modelo (em caixa alta) + Cor + Tela + Conectividade + Sistema operacional + Câm Traseira + Frontal + Memória + Armazenamento", ex: "Smartphone Samsung Galaxy S23+, Preto, Tela 6.6\", 5G+Wi-Fi+NFC, Câm.Traseira Tripla, 8GB RAM, 512GB" },
  { nome: "TV", formula: "produto + Tecnologia (LED,HD) + Polegadas + Marca + Modelo (em caixa alta) + Resolução + Conectividade + Características + Frequência", ex: "Smart TV LED 65\" LG 65UP7550PSF 4K UHD com Wi-Fi, com 1 USB, 2 HDMI, Smart Magic, 60Hz" },
  { nome: "Ventilador", formula: "produto (se é de mesa/Teto/Coluna) + Marca + Modelo (em caixa alta) + Tamanho cm + Velocidades + Características + Cor + Voltagem", ex: "Ventilador de Mesa Arno VD50 50cm Ultra Silence Force com 3 Velocidades Preto 110V" },
  // ⚠️ ATENÇÃO: Cole aqui o array SUBCAT_RULES completo do arquivo original
  // para ter todas as ~150+ regras disponíveis.
];

// ─── Cache em memória ────────────────────────────────────────
let _rules = [...SUBCAT_RULES_DEFAULT];

export const SubcatModule = {
  getAll() { return _rules; },

  async upsert(nome, data) {
    await SubcategoriesDB.upsert(nome, data);
    // Listener atualiza _rules automaticamente
  },

  async delete(nome) {
    await SubcategoriesDB.delete(nome);
  },

  countCustom() {
    const defaultNames = new Set(SUBCAT_RULES_DEFAULT.map(r => r.nome));
    return _rules.filter(r => !defaultNames.has(r.nome)).length;
  },

  async resetAll() {
    // Remove todas do Firestore e reimporta as padrão
    const snap = await SubcategoriesDB.getAll();
    for (const r of snap) {
      await SubcategoriesDB.delete(r.nome);
    }
    await SubcategoriesDB.importBatch(SUBCAT_RULES_DEFAULT);
  },

  /** Inicia sincronização em tempo real */
  startSync() {
    return SubcategoriesDB.listen(rules => {
      // Se o Firestore não tiver regras ainda, usa as padrão embutidas
      _rules = rules.length > 0 ? rules : [...SUBCAT_RULES_DEFAULT];
      // Expõe as regras no AppState para o Pipeline acessar
      AppState.subcatRules.setRules(_rules);
    });
  },

  /** Migra as regras padrão para o Firestore (só precisa rodar uma vez) */
  async migrateDefaultsToFirestore() {
    const existing = await SubcategoriesDB.getAll();
    if (existing.length === 0) {
      await SubcategoriesDB.importBatch(SUBCAT_RULES_DEFAULT);
      console.info('[SubcatModule] Regras padrão migradas para o Firestore.');
    }
  },
};
