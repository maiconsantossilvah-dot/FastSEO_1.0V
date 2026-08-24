# FastSEO - Guia Interno

Este guia resume as regras de manutenção do FastSEO. Ele serve para orientar alterações futuras sem quebrar o fluxo principal do projeto.

## Visão Geral

O FastSEO é uma aplicação modular para gerar fichas técnicas, conferir dados, criar conteúdo comercial, montar FAQs e compilar informações de produtos em arquivos TXT.

O frontend roda no GitHub Pages, o backend Node.js/Express roda no Render e o Firebase fornece autenticação e Firestore. As integrações com Gemini e Mistral continuam no frontend, usando a chave individual configurada por cada usuário.

Em produção, o frontend usa `https://fastseo-users-backend-maicons.onrender.com/api`. O endpoint `/health` pode ser usado para conferir se o backend está disponível.

## Guia de Uso

O FastSEO serve para organizar dados de produtos, gerar fichas técnicas, criar blocos de FAQ e montar arquivos TXT a partir de diferentes fontes.

## Acesso

O acesso ao FastSEO é restrito a usuários autorizados.

1. Abra o FastSEO no navegador.
2. Clique em Entrar com Google.
3. Use uma conta Google autorizada.
4. No primeiro acesso, envie a solicitação pela própria tela.
5. Aguarde a aprovação de um proprietário ou administrador.

Papéis atuais:

- `owner`: acesso integral e garantia de continuidade do último proprietário ativo.
- `admin`: administra usuários, prompts, categorias e analytics, mas não gerencia proprietários ou outros administradores.
- `collaborator`: usa o pipeline e pode editar conteúdo operacional.
- `viewer`: usa o FastSEO e consulta conteúdo publicado, sem permissão de edição.

## Como Usar a Ficha Técnica

A aba Ficha Técnica é usada para processar dados brutos de produtos e gerar uma ficha formatada.

1. Cole os dados do produto no campo Input.
2. Se preferir, importe um PDF, documento Word (.docx), arquivo TXT, planilha ou CSV pelo botão Importar arquivo.
3. Revise se as informações principais estão presentes.
4. Clique em Processar ficha.
5. Aguarde as etapas A1 Formatador, A2 Conferente e A3 Copywriter.
6. Revise o resultado gerado.

O contador de tokens é atualizado conforme cada agente responde. Ele separa entrada, saída e total por chamada e mostra o resumo do processamento, sem incluir ou transmitir a chave da IA.

Resultados disponíveis:

- Ficha técnica formatada.
- Conferência dos dados.
- Conteúdo comercial, quando aplicável.

Ações disponíveis:

- Baixar `.txt`: salva a ficha técnica em arquivo TXT.
- Copiar ficha: copia a ficha formatada.
- Copiar conteúdo: copia o conteúdo comercial.
- Regenerar: gera novamente apenas o conteúdo comercial.

## Como Usar Categorias

A área de Categorias serve para cadastrar referências e exemplos que ajudam o pipeline a identificar famílias de produtos e formatá-las corretamente. O catálogo de trabalho e a versão publicada são gerenciados pelo backend.

Use categorias quando quiser orientar o padrão de uma linha de produtos, como eletrodomésticos, cosméticos, alimentos, eletrônicos ou outras famílias.

Somente `owner` e `admin` podem criar, editar, importar, publicar ou excluir categorias. Colaboradores e espectadores usam apenas o catálogo publicado.

O que cadastrar:

- Nome da categoria.
- Tipo do perfil e categoria pai, quando houver herança.
- Aliases, sinônimos e nomes comerciais.
- Termos negativos para reduzir falsos positivos.
- Campos obrigatórios.
- Campos opcionais.
- Ficha ideal.
- Regras de título, avisos e modificadores.

Fluxo recomendado:

1. Crie ou selecione uma categoria.
2. Para pedir uma sugestão à IA, cole cinco fichas reais e representativas.
3. Clique no botão de análise somente quando desejar gastar tokens.
4. Revise a proposta; ao aprová-la, ela substitui os campos atuais do rascunho.
5. Salve e publique apenas depois da revisão. Alterar o rascunho não muda a versão já publicada.
6. Use Backup antes de migrações ou importações em massa.

Excluir uma categoria é uma operação permanente: remove o perfil, sua versão publicada e os registros legados correspondentes.

## Analytics de Tokens

O FastSEO registra no backend somente metadados de consumo: usuário, agente, provedor, modelo, categoria, duração, status e quantidades de tokens. A chave da API e o conteúdo completo da ficha não fazem parte desse evento.

Somente `owner` e `admin` possuem acesso ao painel Analytics. O painel permite consultar períodos de 7, 30 ou 90 dias e comparar consumo por usuário, agente, modelo e categoria. O custo monetário estimado não faz parte da versão atual.

As coleções `usageEvents` e `usageDaily` são bloqueadas para acesso direto pelo frontend. A gravação e a leitura ocorrem exclusivamente pelo backend usando o Firebase Admin SDK.

## Como Usar Histórico

O Histórico guarda fichas já geradas.

1. Clique em Histórico.
2. Consulte fichas processadas anteriormente.
3. Use a busca ou paginação, se disponível.
4. Copie informações antigas quando precisar reaproveitar algum resultado.

## Como Usar o Criador de FAQ

A aba Criador de FAQ serve para montar um bloco de perguntas e respostas em HTML.

1. Abra a aba Criador de FAQ.
2. Escolha **Manual** para editar cada pergunta ou **Em massa** para colar vários pares.
3. No modo em massa, cole uma lista numerada ou blocos com tags `<Q>` e `<A>`.
4. Clique em Interpretar conteúdo.
5. Confira a prévia.
6. Alterne para a aba HTML se quiser revisar o código.
7. Copie o HTML final.

Formatos aceitos:

```text
1. O produto contém glúten?

Não. O produto não contém glúten.

2. Como usar?

Aplique conforme as instruções da embalagem.
```

```text
<Q>O produto contém glúten?</Q>
<A>Não. O produto não contém glúten.</A>
```

## Como Usar o Compilador de Dados

A aba Compilador de Dados serve para montar arquivos TXT manualmente, sem uso de IA.

Campos obrigatórios:

- Código do Produto.
- Título.
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
2. Preencha os campos obrigatórios.
3. Cole as informações disponíveis nas fontes opcionais.
4. Se tiver um PDF, use Importar PDF ou arraste o arquivo para o campo PDF.
5. Clique em Gerar TXT.
6. Revise a prévia.
7. Clique em Copiar TXT ou Baixar `.txt`.

O arquivo TXT baixado usa o Código do Produto como nome. Exemplo: `111255.txt`.

## Atalhos e Navegação

- `Ctrl + K` ou `Cmd + K`: abre a busca de telas e ferramentas.
- `Ctrl + Enter` ou `Cmd + Enter`: executa a ação principal da tela atual.
- `Esc`: fecha a busca, dialogs ou navegação móvel.
- Em notebooks e celulares, use o botão de menu para abrir a navegação.
- O FastSEO salva rascunhos locais da Ficha Técnica, Compilador e FAQ para evitar perda acidental durante a navegação.

## Boas Práticas de Uso

- Sempre revise os dados antes de processar.
- Confira EAN, fornecedor e código do produto.
- Não misture dados de produtos diferentes no mesmo input.
- Ao importar arquivos, confira se o texto foi lido corretamente.
- Em PDFs escaneados como imagem, o texto pode não ser extraído.
- Revise o resultado antes de copiar ou baixar.
- Use o Compilador de Dados quando não quiser usar IA.
- Nunca compartilhe sua chave Gemini ou Mistral nem a inclua em prints, commits ou chamados.

## Problemas Comuns

### O PDF não foi lido

O PDF pode estar escaneado como imagem. Nesse caso, o FastSEO não consegue extrair texto sem OCR.

### O botão Processar ficha está desativado

O campo Input provavelmente está vazio.

### O TXT não é gerado

Verifique se Código do Produto, Título, EAN e Fornecedor foram preenchidos.

### O login não funciona

Confirme se o domínio está autorizado no Firebase Authentication e se o backend responde em `/health`. Se a conta estiver pendente, um `owner` ou `admin` precisa aprová-la no FastSEO.

### O backend demora para responder

O plano gratuito do Render pode adormecer sem tráfego. A primeira requisição pode levar cerca de um minuto; o frontend tenta novamente durante esse despertar.

### A categoria não foi aplicada

Confirme se a categoria foi publicada. Rascunhos são visíveis para administração, mas o pipeline consome o catálogo publicado.

### O resultado veio incompleto

Revise o input e confira se as informações do fornecedor estavam completas.

## Regra Principal

Cada feature deve ser independente sempre que possível.

Se uma ferramenta for removida, as outras devem continuar funcionando normalmente. Exemplo: o Compilador de Dados não deve depender do pipeline de IA, e o Criador de FAQ não deve depender das categorias.

## O Que Não Deve Mudar

- Não remover o login com Google/Firebase.
- Não remover a validação de usuários autorizados.
- Não misturar funcionalidades independentes com o pipeline principal.
- Não alterar o formato final da ficha técnica sem aprovação.
- Não alterar o formato final do TXT do Compilador de Dados sem aprovação.
- Não alterar `renderFaqItem()` ou `buildFaqHtml()` sem solicitação específica.
- Não adicionar CSS novo dentro do `index.html`.
- Não colocar regras de negócio diretamente no HTML.
- Não expor novas chaves sensíveis no frontend sem avaliar segurança.
- Não enviar chaves Gemini/Mistral, prompts completos ou conteúdo de fichas para o analytics.
- Não remover suporte existente a PDF, Word, TXT, planilhas ou CSV.

## O Que Pode Fazer

- Criar novas abas e ferramentas independentes.
- Melhorar interface sem mudar comportamento principal.
- Criar novos módulos dentro de `src/modules`.
- Criar novos componentes dentro de `src/components`.
- Melhorar validações e mensagens de erro.
- Corrigir bugs mantendo o formato dos resultados.
- Reaproveitar estilos existentes quando fizer sentido.
- Adicionar suporte a novos formatos de arquivo sem quebrar os atuais.

## Regras Para Novas Features

- A feature deve ter uma responsabilidade clara.
- A feature deve ficar isolada em arquivo próprio quando tiver lógica relevante.
- A ligação com a interface deve passar pelo `main.js` somente quando necessário.
- IDs de elementos devem ser claros e consistentes.
- Alterações de interface reutilizáveis devem ficar preferencialmente em `src/styles/redesign.css` ou em componentes JavaScript, sem CSS inline no `index.html`.
- Antes do commit, testar manualmente a tela alterada no navegador.

## Áreas Sensíveis

Alterar estas áreas com cuidado:

- `src/modules/pipeline.js`
- `src/modules/tokenUsage.js`
- `src/services/usageAnalytics.js`
- `src/services/categoryCatalog.js`
- `src/services/userAccess.js`
- `src/services/api.js`
- `src/firebase/`
- `backend/src/auth/`
- `backend/src/categories/`
- `backend/src/usage/`
- `firestore.rules`
- `render.yaml`
- `src/components/ConfigUI.js`
- `src/modules/history.js`
- `src/modules/prompts.js`
- `src/modules/PDFReader.js`

Esses arquivos podem afetar autenticação, chamadas de IA, histórico, prompts, leitura de arquivos e geração das fichas.

## Backend e Publicação

O GitHub Pages publica somente o frontend. Mudanças em `backend/` exigem um novo deploy do serviço no Render. Mudanças em `firestore.rules` exigem uma publicação separada pelo Firebase CLI.

Verificações de produção:

```text
https://fastseo-users-backend-maicons.onrender.com/health
https://fastseo-users-backend-maicons.onrender.com/api/me
```

`/health` deve responder `status: ok`. `/api/me` sem token deve responder `401`, confirmando que a rota está protegida.

Para publicar as regras:

```powershell
cd C:\Users\maicons\Documents\GitHub\FastSEO_1.0V
pnpm --dir backend firebase:login
pnpm --dir backend deploy:rules
```

Revise e faça commit de `firestore.rules` antes do deploy. Nunca envie `backend/.env`, a conta de serviço ou chaves privadas ao Git.

## Compilador de Dados

O Compilador de Dados deve continuar sem IA.

Campos obrigatórios para gerar TXT:

- Código do Produto
- Título
- EAN
- Fornecedor

Fontes opcionais só devem entrar no TXT quando tiverem conteúdo preenchido.

O arquivo baixado deve usar o código do produto como nome, por exemplo `111255.txt`.

## Criador de FAQ

O Criador de FAQ deve continuar independente do pipeline principal.

Ele pode aceitar perguntas e respostas em massa, gerar HTML e exibir prévia, mas não deve depender de IA para funcionar.

## Padrão de Commit

Commits devem explicar a mudança de forma curta e direta.

Exemplos:

- `Adiciona compilador de dados TXT`
- `Corrige sintaxe do criador de FAQ`
- `Adiciona guia interno do projeto`

## Antes de Finalizar

- Testar se o app carrega.
- Testar a aba alterada.
- Verificar se não apareceu erro no console.
- Conferir se os formatos de saída continuam iguais.
- Se alterou o backend, executar testes e confirmar `/health` após o deploy.
- Se alterou permissões ou coleções, revisar e publicar `firestore.rules` separadamente.
- Testar as permissões de `owner`, `admin`, `collaborator` e `viewer` quando a mudança envolver acesso.
