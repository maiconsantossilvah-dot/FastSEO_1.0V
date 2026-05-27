# FastSEO - Arquitetura do projeto

Aplicacao frontend modular em JavaScript puro, com ES Modules carregados direto pelo navegador.

## Estrutura de pastas

```text
index.html
README.md
src/
  config.js
  main.js
  assets/
    img/
  components/
    AnalyticsModal.js
    CategoriasModal.js
    CategoryModal.js
    ConfigUI.js
    ExemplosModal.js
    HistoryModal.js
    HistoryUI.js
    PipelineUI.js
    PromptModal.js
    SidebarUI.js
    SubcatModal.js
  firebase/
    firebase.js
    firestore.js
  modules/
    PDFReader.js
    categories.js
    history.js
    pipeline.js
    prompts.js
    quota.js
    state.js
    subcategories.js
  services/
    analytics.js
    api.js
    auth.js
    serp.js
  styles/
    main.css
  utils/
    index.js
    matching.js
```

## Responsabilidades

- `src/main.js`: inicializacao do app, login, listeners globais e integracao entre modulos.
- `src/config.js`: configuracoes Firebase, modelos e limites do app.
- `src/firebase/`: inicializacao Firebase e CRUD/listeners do Firestore.
- `src/services/`: chamadas externas e servicos de infraestrutura, como IA, auth, analytics e Google Custom Search.
- `src/modules/`: regras de negocio, estado, pipeline, historico, cotas, prompts, categorias e leitura de PDF.
- `src/components/`: modais e elementos de interface.
- `src/utils/`: helpers puros de sanitizacao, matching e clipboard.
- `src/styles/`: CSS principal.
- `src/assets/img/`: imagens usadas por temas e placeholders.

## Como rodar

ES Modules precisam de servidor HTTP; abrir o HTML via `file://` pode falhar.

```bash
py -m http.server 5500
```

Depois acesse:

```text
http://localhost:5500
```

## Firebase

A aplicacao usa:

- Firebase Auth com Google.
- Firestore para `categories`, `subcategories`, `prompts`, `history` e `usuarios_autorizados`.
- `categories` usa `nome`, `camposObrigatorios`, `camposOpcionais`, `fichaIdeal` e `qaSchema`.
- Categorias antigas com `campos` e `ficha` sao migradas automaticamente para o novo formato.

Para autorizar um usuario, crie um documento na colecao `usuarios_autorizados` usando o e-mail como ID do documento.
