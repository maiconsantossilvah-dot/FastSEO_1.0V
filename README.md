# FastSEO - Arquitetura do projeto

Aplicação frontend modular em JavaScript puro, com ES Modules carregados direto pelo navegador.

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
    WordReader.js
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

- `src/main.js`: inicialização do app, login, listeners globais e integração entre módulos.
- `src/config.js`: configurações Firebase, modelos e limites do app.
- `src/firebase/`: inicialização Firebase e CRUD/listeners do Firestore.
- `src/services/`: chamadas externas e serviços de infraestrutura, como IA, auth, analytics e Google Custom Search.
- `src/modules/`: regras de negócio, estado, pipeline, histórico, cotas, prompts, categorias e leitura de arquivos.
- `src/components/`: modais e elementos de interface.
- `src/utils/`: helpers puros de sanitização, matching e clipboard.
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

A aplicação usa:

- Firebase Auth com Google.
- Firestore para `categories`, `subcategories`, `prompts`, `history` e `usuarios_autorizados`.
- `categories` usa `nome`, `camposObrigatorios`, `camposOpcionais`, `fichaIdeal` e `qaSchema`.
- Categorias antigas com `campos` e `ficha` são migradas automaticamente para o novo formato.

Para autorizar um usuário, crie um documento na coleção `usuarios_autorizados` usando o e-mail como ID do documento.
