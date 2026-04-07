# FastSEO — Arquitetura Modular

## Estrutura de arquivos

```
frontend/
  index.html                    ← HTML puro (sem JS inline)
  src/
    config.js                   ← API keys + Firebase config
    main.js                     ← Bootstrap + event listeners
    styles/
      main.css                  ← Todo o CSS original
    firebase/
      firestore.js              ← Init Firebase + CRUD + onSnapshot
    services/
      api.js                    ← callGemini / callMistral / callAgent
    modules/
      state.js                  ← AppState centralizado
      pipeline.js               ← Orquestrador A1→A2→A3
      categories.js             ← CRUD + startSync (Firestore)
      prompts.js                ← Prompts padrão + customizados
      subcategories.js          ← Regras de título + sync
      history.js                ← Histórico persistente
      quota.js                  ← Cota diária + Logs
    components/
      PipelineUI.js             ← Log, steps, resultados
      SidebarUI.js              ← Sidebar de categorias
      CategoryModal.js          ← Modal editar categoria
      HistoryUI.js              ← Painel de histórico
      PromptModal.js            ← Modal de prompts
      AnalyticsModal.js         ← Modal analytics + Export
      SubcatModal.js            ← Modal títulos SEO
      ConfigUI.js               ← Keys, modelo, tema, sidebar
    utils/
      index.js                  ← Helpers puros
```

## Configurar Firebase

1. Acesse https://console.firebase.google.com
2. Crie um projeto → Firestore Database → Criar banco
3. Copie as credenciais em: Configurações → Seus apps → Web
4. Cole em `src/config.js`:

```js
export const FIREBASE_CONFIG = {
  apiKey:            "AIza...",
  authDomain:        "meu-projeto.firebaseapp.com",
  projectId:         "meu-projeto",
  storageBucket:     "meu-projeto.appspot.com",
  messagingSenderId: "123456",
  appId:             "1:123456:web:abc",
};
```

5. Regras Firestore (Console → Firestore → Regras):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // ⚠️ Proteger com Auth em produção
    }
  }
}
```

## Como rodar

Precisa de servidor HTTP (ES Modules não funcionam com file://).

```bash
# Python
python3 -m http.server 5500 --directory frontend/

# Node
npx serve frontend/

# VS Code: instale "Live Server" e clique em "Go Live"
```

Acesse: http://localhost:5500

## Sincronização em tempo real

Cada coleção tem um `startSync()` que abre um `onSnapshot` do Firestore:

```
Usuário A salva categoria
  ↓
CategoriesDB.create() → Firestore
  ↓
onSnapshot dispara em TODOS os clientes
  ↓
_cache atualizado + SidebarUI.render()
  ↓
Usuário B vê a mudança sem recarregar
```

## Migrar dados do localStorage

Se você já tinha categorias salvas, rode no console do navegador:

```js
// Importar módulo de migração (só uma vez)
import { Categories } from './src/modules/categories.js';

const localCats = JSON.parse(localStorage.getItem('ficha_categorias') || '[]');
for (const cat of localCats) {
  await Categories.create(cat);
}
console.log(`${localCats.length} categorias migradas!`);
```

## Produção (build otimizado)

Para deploy, use Vite para bundle:

```bash
npm create vite@latest fastseo -- --template vanilla
# Mova os arquivos src/ para o projeto Vite
# Configure firebase como dependência npm
npm install firebase
npm run build
```
