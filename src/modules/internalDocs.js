const $ = id => document.getElementById(id);

const docs = [
  {
    category: 'Visão geral',
    tag: 'início',
    title: 'O que é o FastSEO',
    body: [
      'O FastSEO é uma aplicação frontend modular para gerar fichas técnicas, conferir dados, criar FAQs e compilar informações de produtos em TXT.',
      'O projeto roda no navegador, usa Firebase para autenticação e dados, e organiza funcionalidades independentes em módulos separados.',
    ],
    bullets: [
      'Pipeline de fichas técnicas.',
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
      'O acesso ao FastSEO é restrito a usuários autorizados.',
      'Abra o app no navegador, clique em Entrar com Google e use uma conta liberada.',
    ],
    bullets: [
      'Se o acesso for negado, o e-mail precisa ser liberado no Firebase.',
      'Use sempre a conta Google autorizada pela equipe.',
    ],
  },
  {
    category: 'Ficha técnica',
    tag: 'uso',
    title: 'Como usar a Ficha Técnica',
    body: [
      'A aba Ficha Técnica processa dados brutos de produto e gera uma ficha formatada.',
    ],
    bullets: [
      'Cole os dados no campo Input.',
      'Opcionalmente importe PDF, planilha ou CSV.',
      'Revise se as informações principais estão presentes.',
      'Clique em Processar ficha.',
      'Aguarde Formatador, Conferente e Copywriter.',
      'Revise o resultado antes de copiar ou baixar.',
    ],
  },
  {
    category: 'Ficha técnica',
    tag: 'saída',
    title: 'Resultados da Ficha Técnica',
    body: [
      'Depois do processamento, o FastSEO pode mostrar ficha técnica, conferência e conteúdo comercial.',
    ],
    bullets: [
      'Baixar .txt salva a ficha técnica em arquivo TXT.',
      'Copiar ficha copia a ficha formatada.',
      'Copiar conteúdo copia o conteúdo comercial.',
      'Regenerar executa novamente apenas o conteúdo comercial.',
    ],
  },
  {
    category: 'Uso',
    tag: 'categorias',
    title: 'Como usar Categorias',
    body: [
      'Categorias guardam referências e exemplos para orientar o formato de linhas de produtos.',
      'Use quando uma família de produtos precisa seguir um padrão específico.',
    ],
    bullets: [
      'Cadastrar nome da categoria.',
      'Cadastrar campos obrigatórios.',
      'Cadastrar campos opcionais.',
      'Cadastrar ficha ideal.',
      'Cadastrar regras ou exemplos de preenchimento.',
    ],
  },
  {
    category: 'Uso',
    tag: 'histórico',
    title: 'Como usar Histórico',
    body: [
      'O Histórico guarda fichas já geradas para consulta e reaproveitamento.',
    ],
    bullets: [
      'Clique em Histórico.',
      'Consulte fichas processadas anteriormente.',
      'Use busca ou paginação quando disponível.',
      'Copie informações antigas quando precisar reaproveitar algum resultado.',
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
      'Escolha Manual para editar cada pergunta ou Em massa para colar vários pares.',
      'No modo em massa, cole uma lista numerada ou blocos com tags Q/A.',
      'Clique em Interpretar conteúdo.',
      'Confira a prévia ou abra a aba HTML para revisar o código.',
      'Copie o HTML final.',
    ],
  },
  {
    category: 'Uso',
    tag: 'atalhos',
    title: 'Atalhos e navegação',
    bullets: [
      'Ctrl/Cmd + K abre a busca de telas e ferramentas.',
      'Ctrl/Cmd + Enter executa a ação principal da tela atual.',
      'Esc fecha a busca, dialogs ou navegação móvel.',
      'Ficha Técnica, Compilador e FAQ preservam rascunhos locais.',
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
      '1. O produto contém glúten? seguido da resposta embaixo.',
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
      'Preencha Código do Produto, Título, EAN e Fornecedor.',
      'Cole fontes opcionais como Ficha M3, Site, PDF, Placeholder, Simplus ou E-mail.',
      'Use Importar PDF ou arraste um arquivo para o campo PDF.',
      'Clique em Gerar TXT.',
      'Revise a prévia.',
      'Clique em Copiar TXT ou Baixar .txt.',
    ],
  },
  {
    category: 'Uso',
    tag: 'boas práticas',
    title: 'Boas práticas de uso',
    bullets: [
      'Sempre revise os dados antes de processar.',
      'Confira EAN, fornecedor e código do produto.',
      'Não misture dados de produtos diferentes no mesmo input.',
      'Ao importar arquivos, confira se o texto foi lido corretamente.',
      'Em PDFs escaneados como imagem, o texto pode não ser extraído.',
      'Revise o resultado antes de copiar ou baixar.',
      'Use o Compilador de Dados quando não quiser usar IA.',
    ],
  },
  {
    category: 'Problemas',
    tag: 'comuns',
    title: 'Problemas comuns',
    bullets: [
      'PDF não foi lido: pode estar escaneado como imagem.',
      'Botão Processar ficha desativado: o campo Input provavelmente está vazio.',
      'TXT não é gerado: confira Código do Produto, Título, EAN e Fornecedor.',
      'Login não funciona: confirme se o e-mail está autorizado no Firebase.',
      'Resultado veio incompleto: revise o input e os dados do fornecedor.',
    ],
  },
  {
    category: 'Regras',
    tag: 'principal',
    title: 'Regra principal',
    body: [
      'Cada feature deve ser independente sempre que possível.',
      'Se uma ferramenta for removida, as outras devem continuar funcionando normalmente.',
    ],
    note: 'Exemplo: o Compilador de Dados não deve depender do pipeline de IA, e o Criador de FAQ não deve depender das categorias.',
  },
  {
    category: 'Não mudar',
    tag: 'restrição',
    title: 'O que não deve mudar',
    bullets: [
      'Não remover o login com Google/Firebase.',
      'Não remover a validação de usuários autorizados.',
      'Não misturar funcionalidades independentes com o pipeline principal.',
      'Não alterar o formato final da ficha técnica sem aprovação.',
      'Não alterar o formato final do TXT do Compilador de Dados sem aprovação.',
      'Não adicionar CSS novo dentro do index.html.',
      'Não colocar regras de negócio diretamente no HTML.',
      'Não expor novas chaves sensíveis no frontend sem avaliar segurança.',
    ],
  },
  {
    category: 'Permitido',
    tag: 'liberado',
    title: 'O que pode fazer',
    bullets: [
      'Criar novas abas e ferramentas independentes.',
      'Melhorar interface sem mudar comportamento principal.',
      'Criar novos módulos dentro de src/modules.',
      'Criar novos componentes dentro de src/components.',
      'Melhorar validações e mensagens de erro.',
      'Corrigir bugs mantendo o formato dos resultados.',
      'Adicionar suporte a novos formatos de arquivo sem quebrar os atuais.',
    ],
  },
  {
    category: 'Features',
    tag: 'padrão',
    title: 'Regras para novas features',
    bullets: [
      'A feature deve ter uma responsabilidade clara.',
      'A feature deve ficar isolada em arquivo próprio quando tiver lógica relevante.',
      'A ligação com a interface deve passar pelo main.js somente quando necessário.',
      'IDs de elementos devem ser claros e consistentes.',
      'Alterações em layout devem ficar em src/styles/main.css.',
      'Antes do commit, testar manualmente a tela alterada no navegador.',
    ],
  },
  {
    category: 'Áreas sensíveis',
    tag: 'cuidado',
    title: 'Arquivos que exigem cuidado',
    body: [
      'Esses arquivos podem afetar autenticação, chamadas de IA, histórico, prompts, leitura de arquivos e geração das fichas.',
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
      'Fontes opcionais só devem entrar no TXT quando tiverem conteúdo preenchido.',
    ],
    bullets: [
      'Obrigatório: Código do Produto.',
      'Obrigatório: Título.',
      'Obrigatório: EAN.',
      'Obrigatório: Fornecedor.',
      'O arquivo baixado deve usar o código do produto como nome.',
    ],
  },
  {
    category: 'FAQ',
    tag: 'html',
    title: 'Criador de FAQ',
    body: [
      'O Criador de FAQ deve continuar independente do pipeline principal.',
      'Ele pode aceitar perguntas e respostas em massa, gerar HTML e exibir prévia, mas não deve depender de IA para funcionar.',
    ],
  },
  {
    category: 'Commits',
    tag: 'git',
    title: 'Padrão de commit',
    body: [
      'Commits devem explicar a mudança de forma curta e direta.',
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
      'Verificar se não apareceu erro no console.',
      'Conferir se os formatos de saída continuam iguais.',
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
