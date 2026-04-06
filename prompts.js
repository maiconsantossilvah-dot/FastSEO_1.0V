/**
 * modules/prompts.js
 * ───────────────────
 * Gerencia os prompts dos agentes.
 * Fonte primária: Firestore. Fallback: valores padrão embutidos.
 */

import { PromptsDB } from '../firebase/firestore.js';

// ─── Prompts padrão (embutidos no código) ───────────────────
export const PROMPTS_DEFAULT = {
P1: `Formate ficha técnica em blocos temáticos com tópicos. Use só o que foi fornecido.

REGRA SOBRE CAMPOS AUSENTES:
- Para campos gerais da ficha: omita o campo completamente se não houver dado.
- EXCEÇÃO — campos prioritários da categoria: se o exemplo de referência listar campos prioritários e algum não estiver nos dados brutos, inclua o campo com o valor "Não informado" (ex: "Corrente nominal: Não informado").

Estrutura obrigatória:

[CÓDIGO(S)]
[DESCRIÇÃO DO PRODUTO]
Características Principais:
Marca: [valor]
Cor: [valor]
Modelo: [valor]
[EAN(s) — um por linha se houver mais de um]
(inclua apenas os que existirem nos dados brutos — omita completamente os ausentes, NUNCA escreva 'Não informado' para Marca, Modelo ou Cor)

TÍTULO SEO:
Gere um título otimizado para SEO seguindo exatamente a estrutura: Categoria + Marca + Modelo + Atributos principais.
Use os atributos mais relevantes e buscados para o tipo de produto (capacidade, voltagem, cor, tecnologia, etc).
Escreva em linguagem natural, sem separadores como | ou /.

Características Adicionais:
— Liste cada atributo técnico em linha própria, agrupando em blocos temáticos quando houver informação suficiente.
— Use o formato: NomeDoBloco: (linha separada com os itens abaixo, um por linha sem símbolos no início)
— Blocos sugeridos conforme o produto: Capacidade, Freezer, Recursos e Funções, Portas e Compartimentos, Energia, Instalação e Estrutura, Dimensões, Dimensões com Embalagem, Itens inclusos — use apenas os que tiverem dados.
— Quando houver dados de dimensões com e sem embalagem, separe sempre em dois blocos distintos: "Dimensões:" e "Dimensões com Embalagem:" — nunca misture os dois no mesmo bloco.
— Atributos isolados que não se encaixam em bloco ficam como linha direta: Atributo: valor

Benefícios:
— Lista de vantagens de forma atrativa ao consumidor, uma por linha, sem nenhum símbolo no início de cada linha.

Fornecedor: [copie o nome EXATAMENTE como está nos dados brutos, caractere por caractere — incluindo &, %, /, \\, números e qualquer símbolo. NUNCA remova, altere ou normalize nada do nome do fornecedor]`,

P2: `QA de ficha técnica. Compare a FICHA GERADA com os DADOS BRUTOS fornecidos.

REGRAS DE APROVAÇÃO — só reprove se houver erro real:
- Reprove se um dado que existia nos dados brutos foi omitido ou alterado incorretamente na ficha.
- Reprove se há inconsistência interna (ex: valor A no título e valor B nas características).
- Reprove se há campos [NÃO INFORMADO] quando o dado existia nos dados brutos.

REGRAS DE NÃO REPROVAR — nunca reprove por:
- Blocos temáticos ausentes (Freezer, Portas, Instalação, etc.) — são opcionais e só aparecem se o produto tiver esses dados.
- Campos omitidos que realmente não se aplicam ao tipo de produto (ex: Cor omitida se não há cor nos brutos).
- Campos marcados como "Não informado" para itens da lista de campos prioritários — isso é comportamento esperado.
- Nomes de fornecedores com caracteres especiais (&, &&, %, /, \\, números, siglas) — são nomes próprios válidos.
- Repetição entre Características e Benefícios — Benefícios têm propósito comercial.
- Título SEO diferente da descrição do produto — são campos distintos com propósitos distintos.

Responda apenas:
STATUS: APROVADO
ou
STATUS: REPROVADO
ERROS:
- [erro específico citando o dado nos brutos vs o que foi gerado]`,

P3: `Crie conteúdo comercial para e-commerce com base na ficha fornecida. Cada seção deve ser diferente das outras — varie o ângulo, os benefícios destacados e a linguagem.

REGRAS ABSOLUTAS:
- Jamais mencione o nome do produto, marca ou modelo em nenhuma das seções.
- Não use traços (-), bullets (•), hífens ou qualquer símbolo no início das frases. Escreva em texto corrido.
- Respeite rigorosamente os limites de caracteres de cada seção — não ultrapasse.

DESCRIÇÃO ABREVIADA: (máximo 600 caracteres)
Texto em terceira pessoa, linguagem de venda. Destaque os principais diferenciais, características e benefícios. Texto corrido, sem listas.

KEYWORD: (máximo 240 caracteres)
Texto chamativo em terceira pessoa, linguagem persuasiva. Desperte o interesse do consumidor destacando um benefício. Texto corrido.

META DESCRIPTION: (máximo 140 caracteres)
Texto em terceira pessoa destacando um diferencial. Termine obrigatoriamente com "Confira agora!". Texto corrido.`,

P1B: `Formate ficha técnica bivolt (110V e 220V) em blocos temáticos com tópicos. Use só o que foi fornecido.

REGRA SOBRE CAMPOS AUSENTES:
- Para campos gerais da ficha: omita o campo completamente se não houver dado.
- EXCEÇÃO — campos prioritários da categoria: se o exemplo de referência listar campos prioritários e algum não estiver nos dados brutos, inclua o campo com o valor "Não informado".

REGRA PRINCIPAL — compare os dois modelos atributo por atributo:
- Se o material bruto NÃO especificar diferença entre 110V e 220V para um atributo → liste uma única vez, SEM mencionar voltagem.
- Se o material bruto especificar valores DIFERENTES por voltagem → liste separando assim:
  110V: [valor]
  220V: [valor]

Estrutura obrigatória:
[CÓDIGO(S)]
[DESCRIÇÃO DO PRODUTO — sem voltagem no título]
[EAN(s) — um por linha, identificando a voltagem se houver EANs distintos]
Marca: [valor] | Modelo: [valor] | Cor: [valor]

TÍTULO SEO:
Gere um título otimizado para SEO. Não mencione voltagem no título SEO pois este é o produto pai.

CARACTERÍSTICAS PRINCIPAIS:
— Liste cada atributo técnico em linha própria, agrupando em blocos temáticos.
— Atributos que diferem por voltagem ficam com 110V: / 220V: dentro do bloco correspondente.

BENEFÍCIOS:
— Lista de vantagens comuns aos dois modelos, uma por linha, sem símbolo no início.

Fornecedor: [copie o nome EXATAMENTE como está nos dados brutos]`,

P2B: `QA de ficha técnica bivolt (110V e 220V).

REGRA CRÍTICA sobre diferenciação por voltagem:
- Se o material bruto NÃO especificava diferença para um atributo → APROVAR mesmo que a ficha liste separado por voltagem.
- Só REPROVAR se o material bruto claramente mostrava valores DISTINTOS por voltagem e a ficha ignorou isso.

Demais verificações — só reprove se for erro real.

Responda apenas:
STATUS: APROVADO
ou
STATUS: REPROVADO
ERROS:
- [erro específico]`,

P3B: `Crie conteúdo comercial para e-commerce de produto com versões 110V e 220V. Use apenas informações comuns aos dois modelos.

REGRAS ABSOLUTAS:
- Jamais mencione o nome do produto, marca, modelo ou voltagem.
- Não use traços (-), bullets (•), ou qualquer símbolo no início das frases. Texto corrido.
- Respeite rigorosamente os limites de caracteres.

TÍTULO PAI: (máximo 150 caracteres)
DESCRIÇÃO ABREVIADA: (máximo 600 caracteres)
KEYWORD: (máximo 240 caracteres)
META DESCRIPTION: (máximo 140 caracteres) — termine com "Confira agora!"`,
};

export const PROMPT_LABELS = {
  P1: 'A1 — Ficha Padrão', P2: 'A2 — QA Padrão',  P3: 'A3 — Copy Padrão',
  P1B:'A1 — Ficha Bivolt', P2B:'A2 — QA Bivolt',   P3B:'A3 — Copy Bivolt',
};

// ─── Cache em memória dos prompts customizados ───────────────
let _custom = {};

export const Prompts = {
  /** Retorna o prompt em uso (custom > padrão) */
  get(key) { return _custom[key] || PROMPTS_DEFAULT[key]; },

  isCustom(key) { return key in _custom; },

  /** Salva no Firestore e atualiza cache local */
  async save(key, value) {
    if (value === PROMPTS_DEFAULT[key]) {
      // Voltou ao padrão: remove customização
      delete _custom[key];
      await PromptsDB.delete(key);
    } else {
      _custom[key] = value;
      await PromptsDB.save(key, value);
    }
  },

  /** Restaura todos os prompts padrão */
  async restoreAll() {
    for (const key of Object.keys(_custom)) {
      await PromptsDB.delete(key);
    }
    _custom = {};
  },

  /** Inicia sincronização em tempo real */
  startSync() {
    return PromptsDB.listen(customObj => {
      _custom = customObj;
    });
  },
};
