# FastSEO - Guia Interno

Este guia resume as regras de manutencao do FastSEO. Ele serve para orientar alteracoes futuras sem quebrar o fluxo principal do projeto.

## Visao Geral

O FastSEO e uma aplicacao frontend modular para gerar fichas tecnicas, conferir dados, criar FAQs e compilar informacoes de produtos em arquivos TXT.

O projeto roda no navegador, usa Firebase para autenticacao e dados, e mantem funcionalidades independentes em modulos separados.

## Guia De Uso

O FastSEO serve para organizar dados de produtos, gerar fichas tecnicas, criar blocos de FAQ e montar arquivos TXT a partir de diferentes fontes.

## Acesso

O acesso ao FastSEO e restrito a usuarios autorizados.

1. Abra o FastSEO no navegador.
2. Clique em Entrar com Google.
3. Use uma conta Google autorizada.
4. Caso o acesso seja negado, solicite a liberacao do e-mail no Firebase.

## Como Usar A Ficha Tecnica

A aba Ficha Tecnica e usada para processar dados brutos de produtos e gerar uma ficha formatada.

1. Cole os dados do produto no campo Input.
2. Se preferir, importe um PDF, planilha ou CSV pelo botao Importar arquivo.
3. Revise se as informacoes principais estao presentes.
4. Clique em Processar ficha.
5. Aguarde as etapas Formatador, Conferente e Copywriter.
6. Revise o resultado gerado.

Resultados disponiveis:

- Ficha tecnica formatada.
- Conferencia dos dados.
- Conteudo comercial, quando aplicavel.

Acoes disponiveis:

- Baixar `.txt`: salva a ficha tecnica em arquivo TXT.
- Copiar ficha: copia a ficha formatada.
- Copiar conteudo: copia o conteudo comercial.
- Regenerar: gera novamente apenas o conteudo comercial.

## Como Usar Categorias

A area de Categorias serve para cadastrar referencias e exemplos que ajudam o pipeline a formatar produtos corretamente.

Use categorias quando quiser orientar o padrao de uma linha de produtos, como eletrodomesticos, cosmeticos, alimentos, eletronicos ou outras familias.

O que cadastrar:

- Nome da categoria.
- Campos obrigatorios.
- Campos opcionais.
- Ficha ideal.
- Regras ou exemplos de preenchimento.

## Como Usar Historico

O Historico guarda fichas ja geradas.

1. Clique em Historico.
2. Consulte fichas processadas anteriormente.
3. Use a busca ou paginacao, se disponivel.
4. Copie informacoes antigas quando precisar reaproveitar algum resultado.

## Como Usar O Criador De FAQ

A aba Criador de FAQ serve para montar um bloco de perguntas e respostas em HTML.

1. Abra a aba Criador de FAQ.
2. Preencha perguntas e respostas manualmente.
3. Ou cole um bloco com perguntas e respostas no campo de preenchimento em massa.
4. Clique em Preencher campos.
5. Confira a previa.
6. Copie o HTML final.

Formatos aceitos:

```text
1. O produto contem gluten?

Nao. O produto nao contem gluten.

2. Como usar?

Aplique conforme as instrucoes da embalagem.
```

```text
<Q>O produto contem gluten?</Q>
<A>Nao. O produto nao contem gluten.</A>
```

## Como Usar O Compilador De Dados

A aba Compilador de Dados serve para montar arquivos TXT manualmente, sem uso de IA.

Campos obrigatorios:

- Codigo do Produto.
- Titulo.
- EAN.
- Fornecedor.

Fontes opcionais:

- Ficha M3.
- Site do Fornecedor.
- PDF.
- Placeholder.
- Simplus.
- E-mail do Fornecedor.

Somente fontes preenchidas entram no TXT final.

1. Abra a aba Compilador de Dados.
2. Preencha os campos obrigatorios.
3. Cole as informacoes disponiveis nas fontes opcionais.
4. Se tiver um PDF, use Importar PDF ou arraste o arquivo para o campo PDF.
5. Clique em Gerar TXT.
6. Revise a previa.
7. Clique em Copiar TXT ou Baixar `.txt`.

O arquivo TXT baixado usa o Codigo do Produto como nome. Exemplo: `111255.txt`.

## Boas Praticas De Uso

- Sempre revise os dados antes de processar.
- Confira EAN, fornecedor e codigo do produto.
- Nao misture dados de produtos diferentes no mesmo input.
- Ao importar arquivos, confira se o texto foi lido corretamente.
- Em PDFs escaneados como imagem, o texto pode nao ser extraido.
- Revise o resultado antes de copiar ou baixar.
- Use o Compilador de Dados quando nao quiser usar IA.

## Problemas Comuns

### O PDF nao foi lido

O PDF pode estar escaneado como imagem. Nesse caso, o FastSEO nao consegue extrair texto sem OCR.

### O botao Processar ficha esta desativado

O campo Input provavelmente esta vazio.

### O TXT nao e gerado

Verifique se Codigo do Produto, Titulo, EAN e Fornecedor foram preenchidos.

### O login nao funciona

Confirme se o e-mail esta autorizado no Firebase.

### O resultado veio incompleto

Revise o input e confira se as informacoes do fornecedor estavam completas.

## Regra Principal

Cada feature deve ser independente sempre que possivel.

Se uma ferramenta for removida, as outras devem continuar funcionando normalmente. Exemplo: o Compilador de Dados nao deve depender do pipeline de IA, e o Criador de FAQ nao deve depender das categorias.

## O Que Nao Deve Mudar

- Nao remover o login com Google/Firebase.
- Nao remover a validacao de usuarios autorizados.
- Nao misturar funcionalidades independentes com o pipeline principal.
- Nao alterar o formato final da ficha tecnica sem aprovacao.
- Nao alterar o formato final do TXT do Compilador de Dados sem aprovacao.
- Nao adicionar CSS novo dentro do `index.html`.
- Nao colocar regras de negocio diretamente no HTML.
- Nao expor novas chaves sensiveis no frontend sem avaliar seguranca.
- Nao remover suporte existente a PDF, planilhas ou CSV.

## O Que Pode Fazer

- Criar novas abas e ferramentas independentes.
- Melhorar interface sem mudar comportamento principal.
- Criar novos modulos dentro de `src/modules`.
- Criar novos componentes dentro de `src/components`.
- Melhorar validacoes e mensagens de erro.
- Corrigir bugs mantendo o formato dos resultados.
- Reaproveitar estilos existentes quando fizer sentido.
- Adicionar suporte a novos formatos de arquivo sem quebrar os atuais.

## Regras Para Novas Features

- A feature deve ter uma responsabilidade clara.
- A feature deve ficar isolada em arquivo proprio quando tiver logica relevante.
- A ligacao com a interface deve passar pelo `main.js` somente quando necessario.
- IDs de elementos devem ser claros e consistentes.
- Alteracoes em layout devem ficar em `src/styles/main.css`.
- Antes do commit, testar manualmente a tela alterada no navegador.

## Areas Sensiveis

Alterar estas areas com cuidado:

- `src/modules/pipeline.js`
- `src/services/api.js`
- `src/firebase/`
- `src/components/ConfigUI.js`
- `src/modules/history.js`
- `src/modules/prompts.js`
- `src/modules/PDFReader.js`

Esses arquivos podem afetar autenticacao, chamadas de IA, historico, prompts, leitura de arquivos e geracao das fichas.

## Compilador de Dados

O Compilador de Dados deve continuar sem IA.

Campos obrigatorios para gerar TXT:

- Codigo do Produto
- Titulo
- EAN
- Fornecedor

Fontes opcionais so devem entrar no TXT quando tiverem conteudo preenchido.

O arquivo baixado deve usar o codigo do produto como nome, por exemplo `111255.txt`.

## Criador de FAQ

O Criador de FAQ deve continuar independente do pipeline principal.

Ele pode aceitar perguntas e respostas em massa, gerar HTML e exibir previa, mas nao deve depender de IA para funcionar.

## Padrao De Commit

Commits devem explicar a mudanca de forma curta e direta.

Exemplos:

- `Adiciona compilador de dados TXT`
- `Corrige sintaxe do criador de FAQ`
- `Adiciona guia interno do projeto`

## Antes De Finalizar

- Testar se o app carrega.
- Testar a aba alterada.
- Verificar se nao apareceu erro no console.
- Conferir se os formatos de saida continuam iguais.
