# FastSEO - Arquitetura do projeto

Aplicação frontend modular em JavaScript puro, com ES Modules carregados direto pelo navegador, e um backend incremental em TypeScript dedicado ao gerenciamento de usuários.

## Estrutura de pastas

```text
index.html
README.md
firebase.json
firestore.rules
backend/
  src/
    auth/
    audit/
    users/
  tests/
src/
  config.js
  main.js
  assets/
    img/
  components/
    AppShell.js
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
    TextReader.js
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
    redesign.css
  utils/
    index.js
    matching.js
```

## Responsabilidades

- `src/main.js`: inicialização do app, login, listeners globais e integração entre módulos.
- `src/config.js`: configurações Firebase, modelos e limites do app.
- `src/firebase/`: inicialização Firebase e CRUD/listeners do Firestore.
- `src/services/`: chamadas externas e serviços de infraestrutura, como IA, auth, analytics e Google Custom Search.
- `src/services/userAccess.js`: cliente autenticado do backend e estado central de permissões no frontend.
- `backend/`: valida Firebase ID Tokens e concentra aprovação, cargos, status e auditoria de usuários.
- `firestore.rules`: aplica a leitura/escrita por cargo também fora da interface.
- `src/modules/`: regras de negócio, estado, pipeline, histórico, cotas, prompts, categorias e leitura de arquivos.
- `src/components/`: modais e elementos de interface.
- `src/utils/`: helpers puros de sanitização, matching e clipboard.
- `src/styles/`: CSS principal.
- `src/components/AppShell.js`: shell responsivo, Lucide, central de comandos, atalhos e rascunhos locais.
- `src/styles/redesign.css`: tokens azul/branco, componentes reutilizáveis, responsividade e motion da interface atual.
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
- Firestore para `categories`, `subcategories`, `prompts`, `history`, `users` e `auditLogs`.
- `categories` usa `nome`, `camposObrigatorios`, `camposOpcionais`, `fichaIdeal` e `qaSchema`.
- Categorias antigas com `campos` e `ficha` são migradas automaticamente para o novo formato.

## Interface

- A iconografia usa Lucide 1.31.0 carregado por CDN com versão fixa.
- Animações e transições reutilizáveis ficam em CSS; JavaScript apenas coordena classes e estados.
- `prefers-reduced-motion` desativa movimento não essencial.
- A identidade visual usa o azul e o branco do favicon nos temas claro e escuro.

## Backend de usuários

O login Google permanece no Firebase Authentication. Depois do login, o frontend envia o Firebase ID Token ao backend, que cria uma solicitação `pending` ou valida um perfil já ativo. Aprovação, rejeição, mudança de cargo, suspensão e reativação passam exclusivamente pelo backend.

Para desenvolvimento, configure e inicie o serviço seguindo [backend/README.md](backend/README.md). O primeiro owner é criado por meio da variável temporária `BOOTSTRAP_OWNER_EMAILS`; usuários seguintes entram como pendentes e, quando aprovados, sempre começam como viewer.

Em produção, o frontend permanece no GitHub Pages e o backend é executado no Cloud Run. O contêiner, a identidade de execução, o CORS e o procedimento via Google Cloud Shell estão documentados em [backend/README.md](backend/README.md). O arquivo JSON usado localmente nunca deve ser incluído no contêiner ou enviado ao repositório.

### Ordem segura de ativação

1. Configure e inicie o backend com `BOOTSTRAP_OWNER_EMAILS` contendo o primeiro proprietário.
2. Publique o frontend e entre com essa conta para criar `users/{uid}` como owner ativo.
3. Confirme o documento no Firestore e remova a variável temporária de bootstrap.
4. Somente então publique as regras versionadas:

```bash
firebase deploy --only firestore:rules
```

Não publique as regras antes de existir ao menos um owner ativo: sem um perfil ativo, as coleções operacionais serão bloqueadas como parte da proteção esperada.

As integrações de IA, chaves, pipeline, FAQ, Compilador e demais módulos operacionais não foram migrados para o backend nesta etapa.
