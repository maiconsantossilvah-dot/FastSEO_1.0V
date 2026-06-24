const $ = id => document.getElementById(id);

const docs = [
  {
    category: 'Visao geral',
    tag: 'inicio',
    title: 'O que e o FastSEO',
    body: [
      'O FastSEO e uma aplicacao frontend modular para gerar fichas tecnicas, conferir dados, criar FAQs e compilar informacoes de produtos em TXT.',
      'O projeto roda no navegador, usa Firebase para autenticacao e dados, e organiza funcionalidades independentes em modulos separados.',
    ],
    bullets: [
      'Pipeline de fichas tecnicas.',
      'Criador de FAQ em HTML.',
      'Compilador de Dados sem IA.',
      'Leitura de PDF, planilhas e CSV.',
    ],
  },
  {
    category: 'Uso',
    tag: 'acesso',
    title: 'Acesso ao FastSEO',
    body: [
      'O acesso ao FastSEO e restrito a usuarios autorizados.',
      'Abra o app no navegador, clique em Entrar com Google e use uma conta liberada.',
    ],
    bullets: [
      'Se o acesso for negado, o e-mail precisa ser liberado no Firebase.',
      'Use sempre a conta Google autorizada pela equipe.',
    ],
  },
  {
    category: 'Ficha tecnica',
    tag: 'uso',
    title: 'Como usar a Ficha Tecnica',
    body: [
      'A aba Ficha Tecnica processa dados brutos de produto e gera uma ficha formatada.',
    ],
    bullets: [
      'Cole os dados no campo Input.',
      'Opcionalmente importe PDF, planilha ou CSV.',
      'Revise se as informacoes principais estao presentes.',
      'Clique em Processar ficha.',
      'Aguarde Formatador, Conferente e Copywriter.',
      'Revise o resultado antes de copiar ou baixar.',
    ],
  },
  {
    category: 'Ficha tecnica',
    tag: 'saida',
    title: 'Resultados da Ficha Tecnica',
    body: [
      'Depois do processamento, o FastSEO pode mostrar ficha tecnica, conferencia e conteudo comercial.',
    ],
    bullets: [
      'Baixar .txt salva a ficha tecnica em arquivo TXT.',
      'Copiar ficha copia a ficha formatada.',
      'Copiar conteudo copia o conteudo comercial.',
      'Regenerar executa novamente apenas o conteudo comercial.',
    ],
  },
  {
    category: 'Uso',
    tag: 'categorias',
    title: 'Como usar Categorias',
    body: [
      'Categorias guardam referencias e exemplos para orientar o formato de linhas de produtos.',
      'Use quando uma familia de produtos precisa seguir um padrao especifico.',
    ],
    bullets: [
      'Cadastrar nome da categoria.',
      'Cadastrar campos obrigatorios.',
      'Cadastrar campos opcionais.',
      'Cadastrar ficha ideal.',
      'Cadastrar regras ou exemplos de preenchimento.',
    ],
  },
  {
    category: 'Uso',
    tag: 'historico',
    title: 'Como usar Historico',
    body: [
      'O Historico guarda fichas ja geradas para consulta e reaproveitamento.',
    ],
    bullets: [
      'Clique em Historico.',
      'Consulte fichas processadas anteriormente.',
      'Use busca ou paginacao quando disponivel.',
      'Copie informacoes antigas quando precisar reaproveitar algum resultado.',
    ],
  },
  {
    category: 'FAQ',
    tag: 'uso',
    title: 'Como usar o Criador de FAQ',
    body: [
      'A aba Criador de FAQ monta um bloco de perguntas e respostas em HTML.',
    ],
    bullets: [
      'Preencha perguntas e respostas manualmente.',
      'Ou cole um bloco no preenchimento em massa.',
      'Clique em Preencher campos.',
      'Confira a previa.',
      'Copie o HTML final.',
    ],
  },
  {
    category: 'FAQ',
    tag: 'formatos',
    title: 'Formatos aceitos no FAQ',
    body: [
      'O preenchimento em massa aceita perguntas numeradas ou tags Q/A.',
    ],
    bullets: [
      '1. O produto contem gluten? seguido da resposta embaixo.',
      '<Q>Pergunta?</Q> seguido de <A>Resposta.</A>.',
    ],
  },
  {
    category: 'Compilador',
    tag: 'uso',
    title: 'Como usar o Compilador de Dados',
    body: [
      'O Compilador de Dados monta arquivos TXT manualmente, sem uso de IA.',
    ],
    bullets: [
      'Preencha Codigo do Produto, Titulo, EAN e Fornecedor.',
      'Cole fontes opcionais como Ficha M3, Site, PDF, Placeholder, Simplus ou E-mail.',
      'Use Importar PDF ou arraste um arquivo para o campo PDF.',
      'Clique em Gerar TXT.',
      'Revise a previa.',
      'Clique em Copiar TXT ou Baixar .txt.',
    ],
  },
  {
    category: 'Uso',
    tag: 'boas praticas',
    title: 'Boas praticas de uso',
    bullets: [
      'Sempre revise os dados antes de processar.',
      'Confira EAN, fornecedor e codigo do produto.',
      'Nao misture dados de produtos diferentes no mesmo input.',
      'Ao importar arquivos, confira se o texto foi lido corretamente.',
      'Em PDFs escaneados como imagem, o texto pode nao ser extraido.',
      'Revise o resultado antes de copiar ou baixar.',
      'Use o Compilador de Dados quando nao quiser usar IA.',
    ],
  },
  {
    category: 'Problemas',
    tag: 'comuns',
    title: 'Problemas comuns',
    bullets: [
      'PDF nao foi lido: pode estar escaneado como imagem.',
      'Botao Processar ficha desativado: o campo Input provavelmente esta vazio.',
      'TXT nao e gerado: confira Codigo do Produto, Titulo, EAN e Fornecedor.',
      'Login nao funciona: confirme se o e-mail esta autorizado no Firebase.',
      'Resultado veio incompleto: revise o input e os dados do fornecedor.',
    ],
  },
  {
    category: 'Regras',
    tag: 'principal',
    title: 'Regra principal',
    body: [
      'Cada feature deve ser independente sempre que possivel.',
      'Se uma ferramenta for removida, as outras devem continuar funcionando normalmente.',
    ],
    note: 'Exemplo: o Compilador de Dados nao deve depender do pipeline de IA, e o Criador de FAQ nao deve depender das categorias.',
  },
  {
    category: 'Nao mudar',
    tag: 'restricao',
    title: 'O que nao deve mudar',
    bullets: [
      'Nao remover o login com Google/Firebase.',
      'Nao remover a validacao de usuarios autorizados.',
      'Nao misturar funcionalidades independentes com o pipeline principal.',
      'Nao alterar o formato final da ficha tecnica sem aprovacao.',
      'Nao alterar o formato final do TXT do Compilador de Dados sem aprovacao.',
      'Nao adicionar CSS novo dentro do index.html.',
      'Nao colocar regras de negocio diretamente no HTML.',
      'Nao expor novas chaves sensiveis no frontend sem avaliar seguranca.',
    ],
  },
  {
    category: 'Permitido',
    tag: 'liberado',
    title: 'O que pode fazer',
    bullets: [
      'Criar novas abas e ferramentas independentes.',
      'Melhorar interface sem mudar comportamento principal.',
      'Criar novos modulos dentro de src/modules.',
      'Criar novos componentes dentro de src/components.',
      'Melhorar validacoes e mensagens de erro.',
      'Corrigir bugs mantendo o formato dos resultados.',
      'Adicionar suporte a novos formatos de arquivo sem quebrar os atuais.',
    ],
  },
  {
    category: 'Features',
    tag: 'padrao',
    title: 'Regras para novas features',
    bullets: [
      'A feature deve ter uma responsabilidade clara.',
      'A feature deve ficar isolada em arquivo proprio quando tiver logica relevante.',
      'A ligacao com a interface deve passar pelo main.js somente quando necessario.',
      'IDs de elementos devem ser claros e consistentes.',
      'Alteracoes em layout devem ficar em src/styles/main.css.',
      'Antes do commit, testar manualmente a tela alterada no navegador.',
    ],
  },
  {
    category: 'Areas sensiveis',
    tag: 'cuidado',
    title: 'Arquivos que exigem cuidado',
    body: [
      'Esses arquivos podem afetar autenticacao, chamadas de IA, historico, prompts, leitura de arquivos e geracao das fichas.',
    ],
    bullets: [
      'src/modules/pipeline.js',
      'src/services/api.js',
      'src/firebase/',
      'src/components/ConfigUI.js',
      'src/modules/history.js',
      'src/modules/prompts.js',
      'src/modules/PDFReader.js',
    ],
  },
  {
    category: 'Compilador',
    tag: 'txt',
    title: 'Compilador de Dados',
    body: [
      'O Compilador de Dados deve continuar sem IA.',
      'Fontes opcionais so devem entrar no TXT quando tiverem conteudo preenchido.',
    ],
    bullets: [
      'Obrigatorio: Codigo do Produto.',
      'Obrigatorio: Titulo.',
      'Obrigatorio: EAN.',
      'Obrigatorio: Fornecedor.',
      'O arquivo baixado deve usar o codigo do produto como nome.',
    ],
  },
  {
    category: 'FAQ',
    tag: 'html',
    title: 'Criador de FAQ',
    body: [
      'O Criador de FAQ deve continuar independente do pipeline principal.',
      'Ele pode aceitar perguntas e respostas em massa, gerar HTML e exibir previa, mas nao deve depender de IA para funcionar.',
    ],
  },
  {
    category: 'Commits',
    tag: 'git',
    title: 'Padrao de commit',
    body: [
      'Commits devem explicar a mudanca de forma curta e direta.',
    ],
    bullets: [
      'Adiciona compilador de dados TXT',
      'Corrige sintaxe do criador de FAQ',
      'Adiciona guia interno do projeto',
    ],
  },
  {
    category: 'Checklist',
    tag: 'final',
    title: 'Antes de finalizar',
    bullets: [
      'Testar se o app carrega.',
      'Testar a aba alterada.',
      'Verificar se nao apareceu erro no console.',
      'Conferir se os formatos de saida continuam iguais.',
    ],
  },
];

let initialized = false;
let activeCategory = 'Todos';
let searchQuery = '';

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getCategories() {
  const names = ['Todos', ...new Set(docs.map(item => item.category))];
  return names.map(name => ({
    name,
    count: name === 'Todos' ? docs.length : docs.filter(item => item.category === name).length,
  }));
}

function matchesSearch(item) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;

  const text = [
    item.category,
    item.tag,
    item.title,
    ...(item.body || []),
    ...(item.bullets || []),
    item.note || '',
  ].join(' ').toLowerCase();

  return text.includes(query);
}

function getFilteredDocs() {
  return docs.filter(item => {
    const categoryOk = activeCategory === 'Todos' || item.category === activeCategory;
    return categoryOk && matchesSearch(item);
  });
}

function renderCategories() {
  const box = $('docsCategories');
  if (!box) return;

  box.innerHTML = getCategories().map(category => `
    <button class="docs-category${category.name === activeCategory ? ' active' : ''}" type="button" data-category="${escapeHtml(category.name)}">
      <span>${escapeHtml(category.name)}</span>
      <strong>${category.count}</strong>
    </button>
  `).join('');

  box.querySelectorAll('[data-category]').forEach(button => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category || 'Todos';
      render();
    });
  });
}

function renderCard(item) {
  const body = (item.body || []).map(text => `<p>${escapeHtml(text)}</p>`).join('');
  const bullets = item.bullets?.length
    ? `<ul>${item.bullets.map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ul>`
    : '';
  const note = item.note
    ? `<div class="docs-note"><strong>Nota:</strong> ${escapeHtml(item.note)}</div>`
    : '';

  return `
    <article class="docs-card">
      <div class="docs-card__head">
        <h2>${escapeHtml(item.title)}</h2>
        <span>${escapeHtml(item.tag)}</span>
      </div>
      <div class="docs-card__body">
        ${body}
        ${bullets}
        ${note}
      </div>
    </article>
  `;
}

function renderDocs() {
  const content = $('docsContent');
  const count = $('docsResultCount');
  if (!content) return;

  const items = getFilteredDocs();
  if (count) count.textContent = `${items.length} resultado${items.length === 1 ? '' : 's'}`;

  content.innerHTML = items.length
    ? items.map(renderCard).join('')
    : '<div class="docs-empty">Nenhum item encontrado.</div>';
}

function render() {
  renderCategories();
  renderDocs();
}

function bindEvents() {
  $('docsSearch')?.addEventListener('input', event => {
    searchQuery = event.target.value || '';
    renderDocs();
  });
}

export const InternalDocs = {
  init() {
    if (initialized) return;
    initialized = true;
    bindEvents();
    render();
  },
};
