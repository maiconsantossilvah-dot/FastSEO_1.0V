// serp.js — Integração SerpAPI com cache por usuário
// Coloque este arquivo na raiz do projeto (junto com pipeline.js, config.js etc.)

const SERP_CACHE_PREFIX = 'fastseo_serp_cache_';
const SERP_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// ─── Chave API por usuário ────────────────────────────────────────────────────

export function getSerpApiKey() {
  return localStorage.getItem('fastseo_serp_api_key') || '';
}

export function setSerpApiKey(key) {
  localStorage.setItem('fastseo_serp_api_key', key.trim());
}

export function hasSerpApiKey() {
  return !!getSerpApiKey();
}

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
  } catch (e) {
    // localStorage cheio — limpa caches antigos
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
 * Busca as top keywords relacionadas a uma categoria/produto via SerpAPI.
 * Retorna objeto com keywords estruturadas para injetar nos prompts.
 *
 * @param {string} query - Nome do produto ou categoria (ex: "air fryer 12 litros")
 * @returns {Promise<SerpResult|null>}
 */
export async function buscarKeywords(query) {
  if (!query || !hasSerpApiKey()) return null;

  // Verifica cache primeiro
  const cached = getFromCache(query);
  if (cached) {
    console.log(`[SerpAPI] Cache hit para: "${query}"`);
    return cached;
  }

  try {
    const apiKey = getSerpApiKey();
    const params = new URLSearchParams({
      api_key: apiKey,
      engine: 'google',
      q: query,
      gl: 'br',
      hl: 'pt',
      num: '10'
    });

    const response = await fetch(`https://serpapi.com/search.json?${params}`);

    if (!response.ok) {
      if (response.status === 401) throw new Error('Chave SerpAPI inválida ou expirada.');
      if (response.status === 429) throw new Error('Limite de buscas SerpAPI atingido.');
      throw new Error(`Erro SerpAPI: ${response.status}`);
    }

    const data = await response.json();
    const resultado = processarResultadoSerp(query, data);

    saveToCache(query, resultado);
    console.log(`[SerpAPI] Keywords obtidas para: "${query}"`);
    return resultado;

  } catch (err) {
    console.warn('[SerpAPI] Erro na busca:', err.message);
    return null; // Falha silenciosa — pipeline continua sem SEO
  }
}

/**
 * Processa o resultado bruto da SerpAPI e extrai o que é útil para os prompts.
 */
function processarResultadoSerp(query, data) {
  const termosRelacionados = [];

  // Extrai "related searches" do Google
  if (data.related_searches) {
    data.related_searches.slice(0, 8).forEach(item => {
      if (item.query) termosRelacionados.push(item.query);
    });
  }

  // Extrai termos dos títulos orgânicos (palavras que aparecem com frequência)
  const palavrasFrequentes = extrairPalavrasFrequentes(data.organic_results || []);

  // Extrai "people also ask"
  const perguntasFrequentes = (data.related_questions || [])
    .slice(0, 4)
    .map(q => q.question)
    .filter(Boolean);

  return {
    queryOriginal: query,
    termosRelacionados,
    palavrasChave: palavrasFrequentes,
    perguntasFrequentes,
    totalResultados: data.search_information?.total_results || null,
    timestamp: Date.now()
  };
}

function extrairPalavrasFrequentes(organicResults) {
  const stopWords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
    'para', 'por', 'com', 'sem', 'um', 'uma', 'uns', 'umas', 'o', 'a',
    'os', 'as', 'e', 'ou', 'que', 'se', 'ao', 'aos', 'à', 'às', 'the',
    'and', 'for', 'with', 'in', 'of', 'to', 'a', 'an', 'is', 'are'
  ]);

  const contagem = {};
  organicResults.slice(0, 10).forEach(result => {
    const texto = `${result.title || ''} ${result.snippet || ''}`.toLowerCase();
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
 * Formata o resultado da SerpAPI em texto para injetar no prompt dos agentes.
 *
 * @param {SerpResult} serpResult
 * @returns {string}
 */
export function montarContextoSEO(serpResult) {
  if (!serpResult) return '';

  const linhas = [
    '───────────────────────────────────────',
    '📊 DADOS REAIS DE BUSCA DO GOOGLE (SerpAPI)',
    `Pesquisa: "${serpResult.queryOriginal}"`,
    ''
  ];

  if (serpResult.termosRelacionados.length > 0) {
    linhas.push('🔍 Termos mais buscados relacionados:');
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
