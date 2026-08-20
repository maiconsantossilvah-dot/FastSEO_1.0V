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

Responda SOMENTE JSON válido. Não use Markdown. Não escreva comentários fora do JSON.

CONTRATO DE RESPOSTA:
{
  "status": "APROVADO ou REPROVADO",
  "confianca": "ALTA, MEDIA ou BAIXA",
  "resumo": "frase curta explicando a decisão",
  "erros": [],
  "avisos": [],
  "campos_confirmados": [
    { "campo": "Nome do campo", "valor": "Valor confirmado", "origem": "dados brutos" }
  ],
  "campos_ausentes": [
    { "campo": "Nome do campo", "motivo": "Motivo curto" }
  ],
  "campos_inferidos": [
    { "campo": "Nome do campo", "valor": "Valor", "motivo": "Como foi derivado" }
  ],
  "seo": {
    "status": "APROVADO, REPROVADO ou INDEFINIDO",
    "avisos": [],
    "termos_validos": [],
    "termos_suspeitos": []
  }
}

REGRAS DE REPROVAÇÃO:
- Reprove se um dado dos brutos foi omitido, alterado ou contradito incorretamente.
- Reprove se a ficha inventou especificação técnica, medida, compatibilidade, material, garantia, EAN, código ou fornecedor.
- Reprove se existe inconsistência interna entre descrição, características, benefícios, SEO ou blocos contextuais.
- Reprove se o fornecedor foi alterado, normalizado ou teve símbolos removidos.
- Reprove se o bloco SEO transformou palavra-chave em especificação técnica não confirmada.

REGRAS DE APROVAÇÃO COM AVISOS:
- Aprove com aviso se o input for fraco, mas a ficha não inventar dados.
- Aprove com aviso se campo prioritário da categoria aparecer como "Não informado".
- Aprove com aviso se houver campos inferidos diretamente da descrição do produto.
- Aprove com aviso se o SEO usar termos naturais de busca sem criar fatos técnicos.

REGRAS DE NÃO REPROVAR:
- Não reprove por blocos contextuais ausentes quando não houver dados para eles.
- Não reprove por campos omitidos que realmente não existem nos brutos.
- Não reprove por repetição entre Características e Benefícios.
- Não reprove por benefícios que apenas reformulam características confirmadas.

CRITÉRIO DE CONFIANÇA:
- ALTA: dados principais confirmados, sem erros e poucos avisos.
- MEDIA: aprovado com campos ausentes, inferidos ou input parcialmente incompleto.
- BAIXA: reprovado, input muito insuficiente ou muitos avisos.

Preencha os arrays vazios quando não houver itens. Use aspas duplas em todas as chaves e strings.`,

P3: `Com base na ficha técnica formatada acima, crie conteúdo comercial para e-commerce.
Cada seção deve ser diferente das outras — varie o ângulo e os benefícios destacados.
Se a ficha tiver poucas informações, redistribua os ângulos para evitar repetição.
Entregue apenas o bloco de cópia, sem comentários ou perguntas.

REGRAS:
- Não mencione nome do produto, marca ou modelo em nenhuma das seções.
- Não use traços, bullets ou símbolos no início das frases.
- Escreva sempre em texto corrido, sem listas.
- Respeite os limites de cada seção.
- Não use ponto final no SUBTÍTULO DO PRODUTO.

DESCRIÇÃO ABREVIADA: (máximo 600 caracteres)
Texto em terceira pessoa, linguagem de venda. Destaque diferenciais, características
e benefícios práticos. Não comece com frases genéricas como "Descubra" ou "Conheça".

❌ ERRADO: "Descubra a combinação perfeita de tecnologia e design."
✓ CERTO: "Solução versátil com ampla capacidade interna e controle multitemperatura,
ideal para diferentes tipos de conservação. Conta com prateleiras ajustáveis que
facilitam a organização e melhor aproveitamento do espaço."

SUBTÍTULO DO PRODUTO: (máximo 240 caracteres)
Texto em segunda pessoa, tom explicativo e conversacional. Apresente uma ou duas
funcionalidades concretas usando dados reais da ficha. Use conectivos como "Além disso".
Não use linguagem de venda. Sem ponto final.

❌ ERRADO: "Refrigerador, geladeira, duplex, frost free, inverter, 391 litros"
✓ CERTO: "No refrigerador, você conta com 5 níveis de temperatura, permitindo o
armazenamento adequado de diferentes tipos de alimentos. Além disso, o compartimento
Fresh Zone é ideal para preservar alimentos mais sensíveis"

META DESCRIPTION: (máximo 140 caracteres)
Liste 2 a 3 diferenciais reais separados por vírgulas, de forma direta e enxuta.
Não mencione nome, marca ou modelo. Termine com "Confira agora!"

❌ ERRADO: "Refrigerador Duplex 391L Frost Free Inverter em Aço Escovado. Confira agora!"
✓ CERTO: "Frost Free, tecnologia Inverter, compartimento extrafrio e aço escovado. Confira agora!"`,

P3B: `Com base na ficha técnica formatada acima, crie conteúdo comercial para e-commerce
de produto com versões 110V e 220V. Use apenas informações comuns aos dois modelos.
Entregue apenas o bloco de cópia, sem comentários ou perguntas.

REGRAS:
- Jamais mencione nome do produto, marca, modelo ou voltagem.
- Não use traços, bullets ou símbolos no início das frases.
- Escreva sempre em texto corrido, sem listas.
- Respeite os limites de cada seção.
- Não use ponto final no SUBTÍTULO DO PRODUTO.

TÍTULO PAI: (máximo 150 caracteres)
DESCRIÇÃO ABREVIADA: (máximo 600 caracteres)
SUBTÍTULO DO PRODUTO: (máximo 240 caracteres)
META DESCRIPTION: (máximo 140 caracteres) — termine com "Confira agora!"`,

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

P2B: `QA de ficha técnica bivolt (110V e 220V). Compare a FICHA GERADA com os DADOS BRUTOS fornecidos.

Responda SOMENTE JSON válido. Não use Markdown. Não escreva comentários fora do JSON.

CONTRATO DE RESPOSTA:
{
  "status": "APROVADO ou REPROVADO",
  "confianca": "ALTA, MEDIA ou BAIXA",
  "resumo": "frase curta explicando a decisão",
  "erros": [],
  "avisos": [],
  "campos_confirmados": [],
  "campos_ausentes": [],
  "campos_inferidos": [],
  "seo": {
    "status": "APROVADO, REPROVADO ou INDEFINIDO",
    "avisos": [],
    "termos_validos": [],
    "termos_suspeitos": []
  }
}

REGRA CRÍTICA SOBRE VOLTAGEM:
- Se os dados brutos NÃO especificam diferença entre 110V e 220V para um atributo, aprove mesmo que a ficha liste o atributo de forma comum.
- Se os dados brutos mostram valores claramente distintos por voltagem, reprove se a ficha misturar ou omitir essa diferença.
- Reprove se EANs por voltagem forem trocados, omitidos ou associados à voltagem errada.

REGRAS GERAIS:
- Reprove apenas erro real: dado alterado, omitido, inventado ou contraditório.
- Aprove com aviso quando houver campo prioritário sem dado e marcado como "Não informado".
- Valide também SEO e benefícios: eles podem usar termos naturais, mas não podem inventar especificações.
- Fornecedor deve ser preservado exatamente como nos dados brutos.

CRITÉRIO DE CONFIANÇA:
- ALTA: dados das duas voltagens bem preservados.
- MEDIA: aprovado com campos ausentes, inferidos ou input parcialmente incompleto.
- BAIXA: reprovado, voltagens confusas ou muitos avisos.

Preencha os arrays vazios quando não houver itens. Use aspas duplas em todas as chaves e strings.`,

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
  P1: 'Formatador · Padrão', P2: 'Conferente · Padrão',  P3: 'Copywriter · Padrão',
  P1B:'Formatador · Bivolt', P2B:'Conferente · Bivolt',   P3B:'Copywriter · Bivolt',
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
