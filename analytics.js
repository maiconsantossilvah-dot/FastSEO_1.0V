// analytics.js — Google Analytics 4 para FastSEO
// Coloque este arquivo na raiz do projeto

// ─── Configuração ─────────────────────────────────────────────────────────────
// Substitua pelo seu Measurement ID do GA4 (formato: G-XXXXXXXXXX)
// Você obtém isso em: analytics.google.com → Admin → Streams de dados → Web
const GA_MEASUREMENT_ID = 'G-4KTSCNT8R1'; // ← SUBSTITUA AQUI

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initAnalytics() {
  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID === 'G-4KTSCNT8R1') {
    console.warn('[Analytics] Measurement ID não configurado. Pulando GA4.');
    return;
  }

  // Injeta o script do gtag dinamicamente
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script1);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: true,
    page_title: 'FastSEO',
    page_location: window.location.href
  });

  console.log(`[Analytics] GA4 iniciado: ${GA_MEASUREMENT_ID}`);
}

// ─── Helper interno ───────────────────────────────────────────────────────────

function track(eventName, params = {}) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}

// ─── Eventos do FastSEO ───────────────────────────────────────────────────────

/**
 * Disparado quando o usuário clica em "Processar Ficha"
 * @param {object} params
 * @param {string} params.modelo - Nome do modelo Gemini usado
 * @param {boolean} params.temPDF - Se o input veio de PDF
 * @param {boolean} params.temSEO - Se keywords SerpAPI foram injetadas
 * @param {string} params.categoria - Categoria do produto (se disponível)
 */
export function trackPipelineIniciado({ modelo, temPDF, temSEO, categoria }) {
  track('pipeline_iniciado', {
    modelo_ia: modelo,
    input_pdf: temPDF,
    seo_injetado: temSEO,
    categoria: categoria || 'nao_definida'
  });
}

/**
 * Disparado quando o pipeline completa com sucesso
 * @param {object} params
 * @param {string} params.modelo - Modelo usado
 * @param {number} params.duracaoMs - Tempo total em ms
 * @param {boolean} params.temSEO - Se SEO foi usado
 */
export function trackPipelineConcluido({ modelo, duracaoMs, temSEO }) {
  track('pipeline_concluido', {
    modelo_ia: modelo,
    duracao_segundos: Math.round(duracaoMs / 1000),
    seo_utilizado: temSEO
  });
}

/**
 * Disparado quando o pipeline falha em alguma etapa
 * @param {object} params
 * @param {string} params.etapa - 'formatador' | 'conferente' | 'copywriter'
 * @param {string} params.erro - Mensagem de erro
 * @param {string} params.modelo - Modelo usado
 */
export function trackPipelineErro({ etapa, erro, modelo }) {
  track('pipeline_erro', {
    etapa_falhou: etapa,
    mensagem_erro: erro?.substring(0, 100),
    modelo_ia: modelo
  });
}

/**
 * Disparado quando um PDF é carregado com sucesso
 * @param {number} tamanhoKB - Tamanho do arquivo em KB
 * @param {number} numCaracteres - Caracteres extraídos
 */
export function trackPDFCarregado(tamanhoKB, numCaracteres) {
  track('pdf_carregado', {
    tamanho_kb: Math.round(tamanhoKB),
    caracteres_extraidos: numCaracteres
  });
}

/**
 * Disparado quando o usuário copia ou baixa o resultado
 * @param {string} acao - 'copiar' | 'baixar_txt' | 'copiar_comercial'
 * @param {string} secao - 'ficha' | 'conferencia' | 'comercial'
 */
export function trackExportacao(acao, secao) {
  track('resultado_exportado', {
    acao,
    secao
  });
}

/**
 * Disparado quando o usuário salva a chave SerpAPI
 */
export function trackSerpApiConfigurada() {
  track('serp_api_configurada');
}

/**
 * Disparado quando o SerpAPI retorna keywords com sucesso
 * @param {boolean} doCahe - Se veio do cache
 * @param {string} query - Termo buscado
 */
export function trackSerpBusca(doCache, query) {
  track('serp_busca', {
    do_cache: doCache,
    termo: query?.substring(0, 50)
  });
}

/**
 * Disparado quando o usuário muda o modelo de IA
 * @param {string} modelo - Nome do novo modelo
 */
export function trackModeloAlterado(modelo) {
  track('modelo_alterado', { modelo_ia: modelo });
}

/**
 * Disparado quando o usuário faz login
 * @param {string} metodo - 'google'
 */
export function trackLogin(metodo = 'google') {
  track('login', { method: metodo });
}

/**
 * Disparado quando a cota diária é atingida
 */
export function trackCotaAtingida() {
  track('cota_diaria_atingida');
}

/**
 * Disparado quando o usuário regenera o conteúdo comercial
 */
export function trackRegeneracao() {
  track('conteudo_regenerado');
}
