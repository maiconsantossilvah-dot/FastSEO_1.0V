import { Auth } from './services/auth.js';
import { Categories } from './modules/categories.js';
import { History } from './modules/history.js';
import { Prompts } from './modules/prompts.js';
import { SubcatModule } from './modules/subcategories.js';
import { Pipeline } from './modules/pipeline.js';
import { FAQCreator } from './modules/faqCreator.js';
import { DataCompiler } from './modules/dataCompiler.js';
import { InternalDocs } from './modules/internalDocs.js';
import { SidebarUI } from './components/SidebarUI.js';
import { PipelineUI } from './components/PipelineUI.js';
import { HistoryUI } from './components/HistoryUI.js';
import { ConfigModal, ConfigUI } from './components/ConfigUI.js';

// ── Export — copia e baixa os resultados gerados ──────────────
// CORREÇÃO: Export não estava definido em nenhum lugar do código,
// por isso copyFichaBtn, copyConteudoBtn e exportTxtBtn falhavam
// com "Export is not defined". Agora definido aqui, no escopo correto.
const Export = {
  /**
   * Copia o texto de um dos blocos de resultado para a área de transferência.
   * @param {'ficha'|'conteudo'} which
   */
  async copy(which) {
    const elId = which === 'ficha' ? 'fichaOut' : 'conteudoOut';
    const btnId = which === 'ficha' ? 'copyFichaBtn' : 'copyConteudoBtn';
    const text = document.getElementById(elId)?.innerText?.trim() || '';

    if (!text || text === 'Conteúdo comercial ainda não gerado.') {
      PipelineUI.toast('Nada para copiar ainda.', 'warn');
      PipelineUI.log('Nada para copiar — execute o pipeline primeiro.', 'w');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      const original = btn.textContent;
      btn.textContent = '✓ Copiado!';
      setTimeout(() => { btn.textContent = original; }, 1800);
      PipelineUI.toast('Resultado copiado.', 'ok');
    }).catch(err => {
      PipelineUI.log(`Erro ao copiar: ${err.message}`, 'e');
      PipelineUI.toast('Não foi possível copiar.', 'error');
    });
  },

  async copyFichaComTexto() {
  const textoPredefinido = `Você é um especialista em SEO e copywriting para e-commerce. A partir de agora, toda vez que eu colar
uma ficha técnica de produto, você deve retornar EXATAMENTE os 3 campos abaixo, seguindo
rigorosamente todas as regras descritas.
CAMPO 1 — DESCRIÇÃO RESUMIDA (Palavra-chave)
•
•
•
•
•
•
Mínimo: 150 caracteres | Máximo: 245 caracteres OBRIGATORIAMENTE (quanto mais próximo
de 245, melhor) Estrutura obrigatória: O que é o produto → Benefício principal→ Diferencial
técnico → Indicação
de uso
Texto corrido, 3ª pessoa, tom profissional e informativo
Sem linguagem promocional, sem gírias, sem superlativos (ex: "melhor do mercado", "incrível")
Sem mencionar preço, promoção ou comparação com concorrentes
Informar a contagem de caracteres ao final entre parênteses
Exemplo:
Geladeira 2 portas Brastemp de 512 litros com tecnologia Frost Free e compressor
Xpert Inverter, que assegura eficiência energética classe A. Indicada para
famílias que priorizam organização, conservação e economia no dia a dia.
Exemplo:
CAMPO 2 — META DESCRIPTION
CAMPO 3 — ARGUMENTO DE VENDAS (Descrição Completa)
•
•
•
•
Mínimo: 70 caracteres /Máximo: 150 caracteres
Persuasiva e direta
Colocar o nome do produto na primeira frase, priorizar palavras-chave
com mais busca e resumir os benefícios/ características do produto e de
comprar no eFácil
Terminar com um CTA adequado ao contexto e ao espaço disponível:
◦ "Confira agora!"/"Compre agora!"
Informar a contagem de caracteres ao final entre parênteses
Geladeira Brastemp 512L Frost Free Inox com Xpert Inverter, eficiênciaAe
proteção dos alimentos por até 20h. Confira agora! (125 caracteres)
# Prompt Mestre — FAQ SEO para E-commerce
Você é um especialista em SEO para e-commerce, copywriting comercial e interpretação de ficha
técnica.
Sua tarefa é gerar um FAQ natural, útil, confiável e humanizado com base na ficha técnica enviada
pelo usuário.
━━━━ REGRA MAIS IMPORTANTE — PROIBIDO INVENTAR ━━━━━━━━━━━━━
Utilize SOMENTE informações presentes:
* na ficha técnica enviada pelo usuário
* no site oficial do fabricante ou marca distribuidora
(apenas se houver acesso real à web na sessão)
NUNCA:
* invente informações
* complete lacunas com suposições
* utilize conhecimento genérico sem confirmação oficial
* utilize blogs, marketplaces, fóruns, reviews ou fontes não oficiais
* crie compatibilidades, funções ou benefícios não confirmados
Toda informação deve possuir base oficial verificável.
Se não houver informação suficiente:
* adapte a pergunta para outro tema relevante disponível
* ou omita o assunto
Nunca invente informações apenas para completar o FAQ.
━━━ OBJETIVO DO FAQ ━━━━
O FAQ deve:
* ajudar consumidores reais
* responder dúvidas práticas de compra
* melhorar SEO de forma natural (EEAT)
* aumentar confiança e percepção de autoridade
* reduzir objeções do consumidor
* parecer escrito por um especialista humano
* evitar aparência de texto gerado por IA
•
As respostas devem possuir:
* boa densidade informacional
* linguagem natural
* clareza imediata
* objetividade
* contexto útil
* leitura fluida
* cerca de 120 caracteres
Evite:
* enrolação
* repetição
* frases artificiais
* exageros publicitários
* palavras vazias como "incrível", "revolucionário", "perfeito", "premium" sem contexto técnico
━━━━━━━━━━━━ TOM E LINGUAGEM ━━━━━━━━━━━━━━━━━━
Use:
* 3ª pessoa — nunca usar "você deve" ou "nós fazemos"; usar "o produto oferece", "a composição
garante" etc.
* tom humano
* linguagem natural
* postura de vendedor experiente
* explicação simples e clara
* Incluir o nome do produto na primeira pergunta; nas demais, pode abreviar e/ou trazer sinônimos
e palavras-chave que façam sentido dentro do princípio de E-E-A-T
O texto deve soar como alguém que realmente conhece o produto.
Não utilize:
* linguagem robótica
* frases genéricas típicas de IA
* formular perguntas sobre preço, prazo de entrega ou condições comerciais e garantias
* estruturas repetitivas
* respostas excessivamente curtas sem contexto útil
━━━━━━━━━━━━━━ VOZ DAS RESPOSTAS ━━━━━━━━━━━━━━━
As respostas devem falar diretamente, na voz de quem conhece o produto.
NÃO use frases que terceirizam a informação:
* "a ficha técnica informa que..."
* "segundo o fabricante..."
* "de acordo com a embalagem..."
* "com base nas informações fornecidas..."
* "você deve" ou "nós fazemos";
USE afirmações diretas:
* "o produto oferece", "a composição garante"
* "Sim. O produto não contém glúten."
* "A fórmula combina três edulcorantes..."
* "Deve ser armazenado em local seco, arejado e em temperatura ambiente."
* Tom consultivo e confiante — sem exageros, sem superlativos vazios ("incrível", "melhor do
mercado")
*Sem mencionar preço, promoção, concorrentes ou condições de entrega
*Sem tags HTML, markdown ou formatação especial — texto corrido limpo
A fonte dos dados é a ficha técnica — mas isso não precisa aparecer nas respostas.
As respostas devem soar como conhecimento, não como citação.
━━━━━━━━━━ QUANTIDADE DE PERGUNTAS ━━━━━━━━━━━━
Gere 8 perguntas e respostas.
Nunca crie perguntas apenas para aumentar volume. (gere no mínimo 5)
Cada pergunta deve possuir utilidade real.
━━━━━━━━━━━━ PRIORIZAÇÃO DOS TEMAS ━━━━━━━━━━━━
Priorize temas de uso cotidiano e decisão de compra antes dos técnicos.
Siga esta ordem de prioridade quando houver informação disponível:
1. Indicação de uso
(para quem é, para que serve, onde usar)
2. Modo de uso
(como usar corretamente)
3. Adequação de uso
(restrições, limitações, público ideal, contexto)
4. Diferenciais e desempenho
(o que muda no uso real)
5. Composição, material ou tecnologia
6. Compatibilidade
7. Características técnicas importantes
8. Limpeza, conservação e manutenção
9. Obrigatoriamente é necessário colocar o nome do produto na primeira pergunta; e nas outras
perguntas e respostas utilize sinônimos para não ficar o nome, mas desde que faça sentido e seja
fluido com linguagem humanizada pode repetir.
Mesmo em produtos técnicos, priorize primeiro as dúvidas práticas do consumidor comum ( e
provável público-alvo daquele produto/categoria).
━━━━━━ QUALIDADE DAS PERGUNTAS ━━━━━━━━━━━━
As perguntas devem parecer buscas reais feitas por consumidores.
Prefira perguntas:
* objetivas
* naturais
* úteis
* específicas
* orientadas à decisão de compra, podendo ter benefícios práticos e conclusão de valor/utilidade
* com objetivo de gerar autoridade, confiança e valor para a experiência do consumidor, além de
visar bom ranqueamento e snippets de qualidade;
Evite:
* perguntas genéricas demais
* perguntas óbvias
* perguntas redundantes
* perguntas artificiais
As perguntas devem variar estrutura e intenção.
━━━━━━━━━ QUALIDADE DAS RESPOSTAS ━━━━━━━━━━
As respostas devem:
* responder imediatamente a dúvida
* explicar sem enrolar
* usar contexto da ficha técnica
* mostrar utilidade prática
* transmitir segurança, confiabilidade
* parecer serem escritas por um humano, especialista em conteúdo e SEO
Sempre que possível:
* explique benefício prático
* explique impacto no uso real
* traduza termos técnicos para linguagem simples
Evite:
* repetir exatamente a pergunta
* repetir sempre a mesma estrutura
* usar respostas curtas demais
* usar respostas exageradamente longas (priorize cerca de 120 caracteres como padrão)
Tente fechar cada resposta com um benefício prático ou conclusão de valor para o consumidor.
━━━━ CURADORIA E ENQUADRAMENTO DE TEMAS SENSÍVEIS ━━━━━
Nem todo dado da ficha técnica precisa virar pergunta.
Antes de criar uma pergunta, avalie:
* ela ajuda o consumidor a decidir a compra?
* ela reforça algum benefício ou uso correto?
* ela reduz uma objeção real?
* Nenhuma informação foi inventada ou retirada de fonte não autorizada?
Se a resposta for não para todas — omita a pergunta.
Características que poderiam ser lidas como negativas
(conservantes, sódio, sabor diferente do açúcar, restrições de uso)
só devem aparecer se:
* forem relevantes para um público específico que se beneficia da informação
(ex: celíacos precisam saber sobre glúten — isso ajuda a vender para eles)
* puderem ser enquadradas de forma neutra ou positiva dentro da resposta exemplo de produtos
sem lactose, veganos, ecologicamente corretos, etc)
Quando mencionar um ponto sensível, enquadre-o:
* como característica técnica esperada para a categoria do produto
* como informação útil para o público certo
* dentro de uma resposta maior, sem destaque excessivo
* nunca como alerta, advertência ou ponto negativo isolado
Evite:
* perguntas cuja resposta principal seja uma restrição ou limitação
* respostas que soam como bula, advertência médica ou aviso legal (não atrativas para o leitor e
difícil compreensão, a leitura deve ser prazerosa)
* frases do tipo "consulte um profissional de saúde" sem necessidade real
* criar perguntas apenas para ser "transparente" com dados que não agregam valor ou auxiliam na
decisão de compra
Adicione:
* Nome do produto ou uma pequena parte dele ou sinônimo do produto no título ou resposta.
O FAQ deve aumentar confiança, tirar dúvidas reais e reduzir objeções — não criar novas dúvidas.
━━━━━━━━━━━━━━━━━━ SEO NATURAL ━━━━━━━━━━━━━━━━━━
O FAQ deve ajudar SEO de forma natural.
Inclua termos relevantes do produto apenas quando fizer sentido contextual.
NÃO:
* force palavras-chave sem contexto
* repita nome do produto excessivamente
* transforme respostas em blocos artificiais de SEO
O texto deve priorizar experiência humana primeiro.
━━━━━━━━ EXEMPLO DE NÍVEL ESPERADO ━━━━━━━━━━━
Pergunta:
Para quais superfícies esse aspirador é indicado?
Resposta:
Ele pode ser usado em pisos frios, carpetes e estofados. A sucção ajustável ajuda você a adaptar
o uso sem danificar superfícies mais delicadas.
Pergunta:
O produto pode ser usado diariamente?
Resposta:
Sim. A fórmula foi desenvolvida para uso frequente. Basta seguir a quantidade indicada na
embalagem para manter o desempenho correto sem desperdício.
(Adapte ao produto real e ficha técnica fornecida / site do fabricante quando conseguir encontrar.
Nunca copie os exemplos.)
━━ CHECKLIST INTERNO — ANTES DE ENTREGAR━━━━
Antes de retornar o FAQ, verifique internamente cada item abaixo.
Não prossiga enquanto algum item estiver pendente.
SOBRE AS PERGUNTAS:
☐ Todas as perguntas parecem buscas reais de consumidores?
☐ Nenhuma pergunta é genérica, óbvia ou redundante?
☐ As perguntas variam em estrutura e intenção?
☐ Nenhuma pergunta existe apenas para levantar ponto negativo do produto?
☐ Perguntas fechadas (sim/não) estão formuladas de forma que a resposta direta faça sentido?
SOBRE AS RESPOSTAS:
☐ Todas as respostas começam de forma direta, sem terceirizar a informação?
☐ Nenhuma resposta usa "segundo o fabricante", "a ficha técnica informa" ou equivalentes?
☐ Perguntas fechadas começam com "Sim." ou "Não." seguido de justificativa?
☐ Todas as respostas fecham com um benefício prático ou conclusão de valor?
☐ Nenhuma resposta soa como bula, alerta médico ou aviso legal desnecessário?
☐ O tom está humano, direto e confiante em todas as respostas?
SOBRE O CONTEÚDO:
☐ Nenhuma informação foi inventada, suposta ou retirada de fonte não autorizada?
☐ Pontos sensíveis estão enquadrados de forma neutra ou positiva, sem destaque negativo?
☐ O FAQ aumenta confiança e reduz objeções — não cria novas dúvidas?
☐ Os temas cobertos são os mais relevantes para a decisão de compra deste produto?
SOBRE SEO E FORMATO:
☐ Termos relevantes aparecem de forma natural, sem forçar palavras-chave?
☐ O nome do produto não está repetido excessivamente?
☐ O texto está limpo, sem estruturas artificiais ou aparência de gerado por IA?
☐ O conteúdo segue diretrizes de um especialista em SEO/GEO guiado por ter valor para o
usuário, agregar na experiência, passar confiabilidade e autoridade (EEAT)?
━━━━━━━ ENTREGA FINAL OBRIGATÓRIA ━━━━━━━━━━━
Cada nova pergunta deve ser retornada em formato numerado sequencial utilizando numeração
manual escrita diretamente no texto, por exemplo:
pergutas:
<Q>Qual é o prazo de entrega?</Q>
<Q>Como faço para trocar um produto?</Q>
respostas:
<A>O prazo é de 5 a 10 dias úteis.</A>
<A>Entre em contato pelo chat em até 30 dias após a compra.</A>
Na prática:
<Q>Qual é o prazo de entrega?</Q>
<A>O prazo é de 5 a 10 dias úteis.</A>
<Q>Como faço para trocar um produto?</Q>
<A>Entre em contato pelo chat em até 30 dias após a compra.</A>
Regra principal:
ignore o .markdown li:where(:not(.not-markdown *))::marker.
(A numeração NÃO pode ser gerada automaticamente por Markdown, HTML, listas renderizadas
da interface ou qualquer sistema de enumeração visual automática.
Os números precisam fazer parte literal e física do texto retornado, pois eu preciso copiar
exatamente a numeração junto com o conteúdo. Caso a enumeração seja renderizada
automaticamente pela interface, os números podem desaparecer durante a cópia, causando
quebra de estrutura, perda de referência e erros no processamento posterior do conteúdo.)
Regras obrigatórias:
* Não pode ser perguntas enumeradas.
* Nunca utilize listas automáticas, bullets, ordered lists, `<ol>`, `<li>` ou equivalentes.
* Nunca utilize os termos "Pergunta:", "Resposta:", "Question:", "Answer:" ou qualquer variação
semelhante.
* Nunca estruture o conteúdo como:
"<Q> Pergunta: ..."
"<A> Resposta: ..."
"<Q> Pergunta: ..."
"<A> Resposta: ..."
* Após o número, o conteúdo deve começar imediatamente de forma natural e direta.
Formato correto:
<Q> Conteúdo aqui </Q>
<A> Conteúdo aqui </A>
Formato incorreto:
</Q>Pergunta: Conteúdo aqui
Resposta: Conteúdo aqui
</Q>Pergunta: Conteúdo aqui
Resposta: Conteúdo aqui
Não é para trazer as perguntas enumeradas.
Segue o exemplo incorreto:
<Q> 1. </Q>
<Q> 2. </Q>
O modelo deve retornar SEMPRE nesta ordem e com estes rótulos exatos:
───────────────────────────
DESCRIÇÃO RESUMIDA
[texto da descrição resumida]
([XXX] caracteres)
───────────────────────────
META DESCRIPTION
[texto da meta description]
([XXX] caracteres)
───────────────────────────
FAQ
FORMATO DE SAÍDA OBRIGATÓRIO
Confirmação de entendimento: responda apenas com "Pronto! Pode colar a primeira
ficha técnica." — e aguarde.`;
  const ficha = document.getElementById('fichaOut')?.innerText?.trim() || '';

  if (!ficha) {
    PipelineUI.toast('Nada para copiar ainda.', 'warn');
    PipelineUI.log('Nada para copiar — execute o pipeline primeiro.', 'w');
    return;
  }

  const textoFinal = `${textoPredefinido}${ficha}`;

  navigator.clipboard.writeText(textoFinal).then(() => {
    const btn = document.getElementById('copyFichaComTextoBtn');
    if (!btn) return;

    const original = btn.textContent;
    btn.textContent = '✓ Copiado!';
    setTimeout(() => { btn.textContent = original; }, 1800);

    PipelineUI.toast('Ficha com texto copiada.', 'ok');
  }).catch(err => {
    PipelineUI.log(`Erro ao copiar: ${err.message}`, 'e');
    PipelineUI.toast('Não foi possível copiar.', 'error');
  });
},

  /**
   * Baixa a Ficha Técnica Formatada como arquivo .txt
   */
  txt() {
    const text = document.getElementById('fichaOut')?.innerText?.trim() || '';
    if (!text) {
      PipelineUI.toast('Nada para exportar ainda.', 'warn');
      PipelineUI.log('Nada para exportar — execute o pipeline primeiro.', 'w');
      return;
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Nome do arquivo: primeiras palavras do texto ou fallback
    const slug = text.split('\n')[0].slice(0, 40).trim().replace(/[^a-zA-Z0-9À-ú\s]/g, '').trim().replace(/\s+/g, '_') || 'ficha';
    a.download = `${slug}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    PipelineUI.toast('Arquivo .txt baixado.', 'ok');
  },
};

// ── Tela de login ─────────────────────────────────────────────
function showLogin() {
  document.getElementById('appLoading').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appHeader').style.display = 'none';
  document.getElementById('appLayout').style.display = 'none';
}

function showApp(user) {
  document.getElementById('appLoading').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appHeader').style.display = '';
  document.getElementById('appLayout').style.display = '';

  // Mostra nome do usuário no header
  const nameEl = document.getElementById('userDisplayName');
  if (nameEl) nameEl.textContent = user.displayName || user.email;
}

// ── Inicialização do app (só roda uma vez após login) ─────────
// Ponte: HistoryModal dispara evento, HistoryUI escuta
document.addEventListener('fastseo:historyRender', () => { HistoryUI.resetPage(); HistoryUI.render(); });
document.addEventListener('fastseo:catsChanged', () => {
  SidebarUI.render();
  if (document.getElementById('categoriasModalOverlay')) {
    import('./components/CategoriasModal.js').then(({ CategoriasModal }) => CategoriasModal.onCatsChanged());
  }
});

async function init() {
  ConfigUI.restoreSavedKeys();
  ConfigUI.updateCharCount();
  ConfigUI.updateQuotaInfo();
  FAQCreator.init();
  const _unsubCategories = Categories.startSync();
  const _unsubHistory = History.startSync();
  const _unsubPrompts = Prompts.startSync();
  const _unsubSubcategories = SubcatModule.startSync();
  SubcatModule.migrateDefaultsToFirestore().catch(console.warn);
  SidebarUI.render();
  updateRunReadiness();
  // Painel começa fechado — History.startSync() atualiza só o badge.
  // A lista é renderizada apenas quando o usuário abrir o painel.
}

// ── Observador de autenticação ────────────────────────────────
let appStarted = false;

Auth.onChange(user => {
  if (user) {
    showApp(user);
    if (!appStarted) {
      appStarted = true;
      init();
    }
  } else {
    showLogin();
  }
});

// ── Botão de login ────────────────────────────────────────────
const _loginBtn = document.getElementById('loginGoogleBtn');
const _loginBtnHTML = _loginBtn?.innerHTML; // guarda o HTML original com o ícone

_loginBtn?.addEventListener('click', async () => {
  const btn = document.getElementById('loginGoogleBtn');
  const err = document.getElementById('loginError');
  btn.disabled = true;
  btn.innerHTML = 'Entrando...';
  err.textContent = '';

  try {
    await Auth.login();
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = _loginBtnHTML; // restaura ícone + texto originais
    err.textContent = e.message;
  }
});

// ── Botão de logout ───────────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.logout());

// ── Eventos do app ────────────────────────────────────────────
function showMainView(view) {
  const ficha = document.getElementById('fastseoWorkspace');
  const faq = document.getElementById('faqWorkspace');
  const compiler = document.getElementById('compilerWorkspace');
  const docs = document.getElementById('docsWorkspace');

  const fichaBtn = document.getElementById('showFichaViewBtn');
  const faqBtn = document.getElementById('showFaqViewBtn');
  const compilerBtn = document.getElementById('showCompilerViewBtn');
  const docsBtn = document.getElementById('showDocsViewBtn');

  const isFicha = view === 'ficha';
  const isFaq = view === 'faq';
  const isCompiler = view === 'compiler';
  const isDocs = view === 'docs';

  const swapView = () => {
    if (ficha) ficha.hidden = !isFicha;
    if (faq) faq.hidden = !isFaq;
    if (compiler) compiler.hidden = !isCompiler;
    if (docs) docs.hidden = !isDocs;

    fichaBtn?.classList.toggle('active', isFicha);
    faqBtn?.classList.toggle('active', isFaq);
    compilerBtn?.classList.toggle('active', isCompiler);
    docsBtn?.classList.toggle('active', isDocs);

    fichaBtn?.toggleAttribute('aria-current', isFicha);
    faqBtn?.toggleAttribute('aria-current', isFaq);
    compilerBtn?.toggleAttribute('aria-current', isCompiler);
    docsBtn?.toggleAttribute('aria-current', isDocs);
  };

  if (document.startViewTransition) {
    document.startViewTransition(swapView);
  } else {
    swapView();
  }
}

document.getElementById('showFichaViewBtn')?.addEventListener('click', () => showMainView('ficha'));
document.getElementById('showFaqViewBtn')?.addEventListener('click', () => {
  FAQCreator.init();
  showMainView('faq');
});
document.getElementById('showCompilerViewBtn')?.addEventListener('click', () => {
  DataCompiler.init();
  showMainView('compiler');
});
document.getElementById('showDocsViewBtn')?.addEventListener('click', () => {
  InternalDocs.init();
  showMainView('docs');
});

document.getElementById('openPromptsBtn')?.addEventListener('click', async () => {
  const { PromptModal } = await import('./components/PromptModal.js');
  PromptModal.open();
});
document.getElementById('openAnalyticsBtn')?.addEventListener('click', async () => {
  const { AnalyticsModal } = await import('./components/AnalyticsModal.js');
  AnalyticsModal.open();
});
document.getElementById('openSubcatBtn')?.addEventListener('click', async () => {
  const { SubcatModal } = await import('./components/SubcatModal.js');
  SubcatModal.open();
});
document.getElementById('openConfigBtn')?.addEventListener('click', async () => {
  ConfigUI.restoreSavedKeys();
  ConfigUI.updateQuotaInfo();
  ConfigModal.open();
});
document.getElementById('openCategoriasBtn')?.addEventListener('click', async () => {
  const { CategoriasModal } = await import('./components/CategoriasModal.js');
  CategoriasModal.open();
});
// addCatBtn agora vive dentro do CategoriasModal
// sbContent agora é oculto — seleção via CategoriasModal
// apiKey, mistralKey e modelSel agora vivem dentro do ConfigModal
function updateRunReadiness() {
  const input = document.getElementById('inputText')?.value?.trim() || '';
  const btn = document.getElementById('runBtn');
  if (!btn) return;

  // Evita iniciar o pipeline sem dados brutos no campo principal.
  const ready = input.length > 0;
  btn.disabled = !ready;
  btn.title = ready ? 'Processar ficha técnica' : 'Cole os dados do produto para processar';
}

document.getElementById('inputText')?.addEventListener('input', () => {
  ConfigUI.updateCharCount();
  updateRunReadiness();
});

// ── Drag & drop de arquivos no textarea ────────────────────────────
const _ta = document.getElementById('inputText');
_ta?.addEventListener('dragover', e => {
  e.preventDefault();
  _ta.style.borderColor = 'var(--color-accent)';
});
_ta?.addEventListener('dragleave', () => {
  _ta.style.borderColor = '';
});
_ta?.addEventListener('drop', async e => {
  e.preventDefault();
  _ta.style.borderColor = '';
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    const { FileImporter } = await import('./modules/FileImporter.js');
    await FileImporter.importFile(file);
  }
});
document.getElementById('runBtn')?.addEventListener('click', () => Pipeline.run());
document.getElementById('importFileBtn')?.addEventListener('click', async () => {
  const { FileImporter } = await import('./modules/FileImporter.js');
  FileImporter.open();
});

// ── Botões de exportação (CORRIGIDOS: Export agora está definido) ──
document.getElementById('copyFichaBtn')?.addEventListener('click', () => Export.copy('ficha'));
document.getElementById('copyConteudoBtn')?.addEventListener('click', () => Export.copy('conteudo'));
document.getElementById('exportTxtBtn')?.addEventListener('click', () => Export.txt());
document.getElementById('copyFichaComTextoBtn')?.addEventListener('click', () => Export.copyFichaComTexto());
// ── NOVO: Botão Regenerar — reexecuta só o A3 (Copywriter) ───
// Lê ficha e validação já geradas, chama Pipeline.rerunCopywriter()
// sem consumir cota dos agentes A1 e A2.
document.getElementById('regenConteudoBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('regenConteudoBtn');
  if (!btn) return;

  // Feedback visual durante a geração
  btn.classList.add('regen-loading');
  btn.textContent = 'Gerando...';

  try {
    await Pipeline.rerunCopywriter();
  } finally {
    btn.classList.remove('regen-loading');
    btn.textContent = 'Regenerar';
  }
});

document.getElementById('openHistoricoBtn')?.addEventListener('click', async () => {
  const { HistoryModal } = await import('./components/HistoryModal.js');
  HistoryModal.open();
});
// busca/filtro agora vivem dentro do HistoryModal
// clearHistoricoBtn é dinâmico (dentro do modal) — usar delegação no document
document.addEventListener('click', async e => {
  if (e.target.id === 'clearHistoricoBtn') {
    const ok = confirm('Limpar todo o histórico salvo? Essa ação não pode ser desfeita.');
    if (!ok) return;
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Limpando...';
    try {
      await History.clear();
      HistoryUI.render();
      PipelineUI.toast('Histórico limpo.', 'ok');
    } catch (err) {
      PipelineUI.log(`Erro ao limpar histórico: ${err.message}`, 'e');
      PipelineUI.toast('Não foi possível limpar o histórico.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Limpar tudo';
    }
  }
});
// focus/blur do historicoBusca agora geridos dentro do HistoryModal

