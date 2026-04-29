// serp.js — Integração Google Custom Search API com cache por usuário
// Chaves ficam no localStorage — nada hardcoded no código

const SERP_CACHE_PREFIX = 'fastseo_serp_cache_';
const SERP_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// ─── Chaves por usuário (localStorage) ───────────────────────────────────────

export function getGoogleApiKey() {
  return localStorage.getItem('fastseo_google_api_key') || '';
}

export function setGoogleApiKey(key) {
  localStorage.setItem('fastseo_google_api_key', key.trim());
}

export function getGoogleCx() {
  return localStorage.getItem('fastseo_google_cx') || '';
}

export function setGoogleCx(cx) {
  localStorage.setItem('fastseo_google_cx', cx.trim());
}

export function hasSerpApiKey() {
  return !!getGoogleApiKey() && !!getGoogleCx();
}

// ─── Mantém compatibilidade com código legado que usava SerpAPI ──────────────
export function getSerpApiKey() { return getGoogleApiKey(); }
export function setSerpApiKey(key) { setGoogleApiKey(key); }

// ─── Cache ────────────────────────────────────────────────────────────────────

function getCacheKey(query) {
  return SERP_CACHE_PREFIX + query.toLowerCase().trim().replace(/\s+/g, '_');
}

function getFromCache(query) {
  try {
    const raw = localStorage.getItem(getCacheKey(query));
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > SERP_CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(query));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveToCache(query, data) {
  try {
    localStorage.setItem(getCacheKey(query), JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {
    clearOldSerpCaches();
  }
}

export function clearOldSerpCaches() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(SERP_CACHE_PREFIX));
  keys.forEach(k => {
    try {
      const { timestamp } = JSON.parse(localStorage.getItem(k));
      if (Date.now() - timestamp > SERP_CACHE_TTL_MS) localStorage.removeItem(k);
    } catch {
      localStorage.removeItem(k);
    }
  });
}

// ─── Busca de keywords ────────────────────────────────────────────────────────

/**
 * Busca keywords via Google Custom Search API (sem CORS, gratuito).
 * @param {string} query - Nome do produto ou categoria
 * @returns {Promise<SerpResult|null>}
 */
export async function buscarKeywords(query) {
  if (!query || !hasSerpApiKey()) return null;

  const cached = getFromCache(query);
  if (cached) {
    console.log(`[Google CSE] Cache hit para: "${query}"`);
    return cached;
  }

  try {
    const apiKey = getGoogleApiKey();
    const cx     = getGoogleCx();

    const params = new URLSearchParams({
      key: apiKey,
      cx:  cx,
      q:   query,
      gl:  'br',
      lr:  'lang_pt',
      num: '10'
    });

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params}`
    );

    if (!response.ok) {
      if (response.status === 403) throw new Error('Chave Google inválida, expirada ou cota atingida.');
      if (response.status === 429) throw new Error('Limite de buscas Google atingido (100/dia).');
      throw new Error(`Erro Google CSE: ${response.status}`);
    }

    const data = await response.json();
    const resultado = processarResultadoGoogle(query, data);

    saveToCache(query, resultado);
    console.log(`[Google CSE] Keywords obtidas para: "${query}"`);
    return resultado;

  } catch (err) {
    console.warn('[Google CSE] Erro na busca:', err.message);
    return null; // falha silenciosa — pipeline continua sem SEO
  }
}

/**
 * Processa o resultado da Google Custom Search API.
 */
function processarResultadoGoogle(query, data) {
  const items = data.items || [];

  // Extrai palavras frequentes dos títulos e snippets
  const palavrasFrequentes = extrairPalavrasFrequentes(items);

  // Termos relacionados via queries sugeridas pelo Google
  const termosRelacionados = [];
  const queries = data.queries?.nextPage || data.queries?.request || [];
  queries.forEach(q => {
    if (q.searchTerms && q.searchTerms !== query) {
      termosRelacionados.push(q.searchTerms);
    }
  });

  // Perguntas frequentes extraídas dos snippets
  const perguntasFrequentes = items
    .map(item => item.snippet || '')
    .filter(s => s.includes('?'))
    .map(s => {
      const match = s.match(/[^.!?]*\?/);
      return match ? match[0].trim() : null;
    })
    .filter(Boolean)
    .slice(0, 4);

  return {
    queryOriginal: query,
    termosRelacionados,
    palavrasChave: palavrasFrequentes,
    perguntasFrequentes,
    totalResultados: data.searchInformation?.totalResults || null,
    timestamp: Date.now()
  };
}

function extrairPalavrasFrequentes(items) {
  const stopWords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
    'para', 'por', 'com', 'sem', 'um', 'uma', 'uns', 'umas', 'o', 'a',
    'os', 'as', 'e', 'ou', 'que', 'se', 'ao', 'aos', 'à', 'às', 'the',
    'and', 'for', 'with', 'in', 'of', 'to', 'an', 'is', 'are', 'sua',
    'seu', 'mais', 'como', 'este', 'esta', 'isso', 'ser', 'foi', 'has'
  ]);

  const contagem = {};
  items.slice(0, 10).forEach(item => {
    const texto = `${item.title || ''} ${item.snippet || ''}`.toLowerCase();
    texto.split(/\W+/).forEach(palavra => {
      if (palavra.length > 3 && !stopWords.has(palavra)) {
        contagem[palavra] = (contagem[palavra] || 0) + 1;
      }
    });
  });

  return Object.entries(contagem)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([palavra]) => palavra);
}

// ─── Montagem do contexto SEO para injetar nos prompts ────────────────────────

/**
 * Formata o resultado em texto para injetar no prompt dos agentes.
 * @param {object} serpResult
 * @returns {string}
 */
export function montarContextoSEO(serpResult) {
  if (!serpResult) return '';

  const linhas = [
    '───────────────────────────────────────',
    '📊 DADOS REAIS DE BUSCA DO GOOGLE',
    `Pesquisa: "${serpResult.queryOriginal}"`,
    ''
  ];

  if (serpResult.termosRelacionados.length > 0) {
    linhas.push('🔍 Termos relacionados:');
    serpResult.termosRelacionados.forEach((t, i) => linhas.push(`  ${i + 1}. ${t}`));
    linhas.push('');
  }

  if (serpResult.palavrasChave.length > 0) {
    linhas.push('📝 Palavras-chave frequentes nos resultados:');
    linhas.push('  ' + serpResult.palavrasChave.join(', '));
    linhas.push('');
  }

  if (serpResult.perguntasFrequentes.length > 0) {
    linhas.push('❓ Perguntas frequentes dos compradores:');
    serpResult.perguntasFrequentes.forEach((p, i) => linhas.push(`  ${i + 1}. ${p}`));
    linhas.push('');
  }

  linhas.push('INSTRUÇÃO: Use os termos acima naturalmente no conteúdo gerado.');
  linhas.push('Priorize os termos mais buscados no título e nos primeiros parágrafos.');
  linhas.push('───────────────────────────────────────');

  return linhas.join('\n');
}
