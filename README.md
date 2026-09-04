# FastSEO — arquitetura e desenvolvimento

O FastSEO é uma ferramenta interna para transformar dados brutos de produtos em fichas técnicas, validar fidelidade factual e, opcionalmente, gerar texto comercial. O frontend usa JavaScript com ES Modules; o backend usa TypeScript, Express, Firebase Admin e Firestore.

## Arquitetura atual

```text
index.html                    shell estático publicado no GitHub Pages
src/
  ai/                         gateway, providers, scheduler e contratos do runtime de IA
  main.js                     composição e inicialização da aplicação
  components/                 componentes e modais de interface
  modules/                    pipeline e regras de negócio do frontend
  services/                   APIs, acesso, catálogo e BYOK
  firebase/                   Firebase Auth e acesso permitido ao Firestore
  utils/                      funções reutilizáveis e sem estado
backend/src/
  auth/                       validação do token e autorização por cargo
  users/                      acesso e hierarquia da equipe
  categories/                 catálogo, publicação, herança e resolução
  titleRules/                 regras de título anteriormente chamadas subcategorias
  usage/                      telemetria e agregação administrativa
  audit/                      trilha de alterações administrativas
tests/frontend/               testes unitários do frontend
tests/rules/                  testes das regras do Firestore
backend/tests/                testes unitários do backend
```

O backend é a autoridade para usuários, categorias, regras de título, telemetria e auditoria. O frontend não possui fallback de escrita direta nessas coleções. O histórico novo pertence ao usuário e fica em `users/{uid}/history`; a coleção global antiga é somente leitura administrativa durante a transição.

O runtime de IA separa roteamento, integração HTTP e rate limit. Providers não
dependem da interface; o pipeline traduz eventos neutros em feedback visual. A
decisão e seus limites estão registrados na
[ADR 0001](docs/adr/0001-ai-runtime-boundaries.md).

## BYOK: uma chave por colaborador

As chamadas ao Gemini, à Mistral e à Groq continuam no navegador por decisão de produto: cada membro da equipe utiliza a própria chave. `src/services/apiSettings.js` centraliza esse comportamento, isola os valores pelo Firebase UID no `localStorage` e mantém a escolha de provedor/modelo de A1, A2 e A3. As chaves são enviadas somente ao provedor selecionado, nunca ao backend do FastSEO nem ao Firestore.

Consequências conscientes desse modelo:

- quem controla o perfil do navegador consegue inspecionar a própria chave;
- a métrica de tokens é operacional, não uma fonte financeira incontestável, pois o backend não presencia a chamada original;
- computadores compartilhados devem usar perfis de navegador separados e sessão do sistema bloqueada;
- scripts externos fixos usam Subresource Integrity para reduzir risco de alteração no CDN.

## Executar localmente

Requisitos: Node.js 22 ou superior e pnpm 11. O backend também precisa das credenciais Firebase descritas em `backend/README.md`.

```powershell
cd C:\Users\maicons\Documents\GitHub\FastSEO_1.0V
pnpm install
pnpm dev
```

O frontend abre em `http://localhost:5500`. Em outro terminal:

```powershell
pnpm --dir backend install
pnpm --dir backend dev
```

Use `http://localhost:8787/health` para liveness e `http://localhost:8787/ready` para confirmar que o Firestore também está acessível.

## Qualidade e testes

Os comandos ficam no `package.json` da raiz e podem ser executados de qualquer terminal aberto na raiz:

```powershell
pnpm lint                  # ESLint no frontend e nos testes
pnpm test                  # testes unitários do frontend
pnpm test:watch            # frontend em modo watch
pnpm test:coverage         # relatório em coverage/frontend
pnpm test:rules            # regras Firestore no emulador (requer Java 21 no PATH)
pnpm --dir backend test    # testes do backend
pnpm typecheck             # TypeScript sem gerar arquivos
pnpm build                 # compila o backend
pnpm check                 # bateria completa usada pelo CI
```

O GitHub Actions executa `pnpm check` com Node 24 e Java 21 em cada pull request e push na `main`. Não reduza a cobertura excluindo arquivos sem teste: o relatório inclui todo `src/` para mostrar os pontos ainda descobertos.

## Permissões

- `owner`: maior nível administrativo e proteção contra remoção do último proprietário; históricos pessoais continuam privados.
- `admin`: usuários, catálogo, regras de título, prompts e analytics.
- `collaborator`: pipeline, histórico próprio e operações de conteúdo autorizadas.
- `viewer`: consulta sem mutação.

As restrições de interface são conveniência de UX. A autorização real é repetida no backend e nas regras do Firestore. Categorias e regras de título só podem ser modificadas por `owner` e `admin`; cada mutação relevante gera auditoria.

## Segurança operacional

- Nunca versionar `.env`, JSON de conta de serviço, chaves de IA ou tokens.
- Manter `FRONTEND_ORIGINS` limitado às URLs reais do FastSEO.
- Ativar `ALLOW_PRODUCTION_BOOTSTRAP=true` somente para criar o primeiro owner e removê-lo logo depois.
- Publicar regras com `pnpm --dir backend deploy:rules` somente após revisar o diff e confirmar um owner ativo.
- Fazer backup antes de importações em massa e resolver conflitos de revisão em vez de sobrescrever edições concorrentes.
- O rate limit em memória atende ao serviço gratuito com uma instância; antes de escalar horizontalmente, migrá-lo para um armazenamento compartilhado.

Detalhes de ambiente, deploy, variáveis e endpoints estão em [backend/README.md](backend/README.md).
