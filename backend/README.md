# Backend de usuários do FastSEO

Backend incremental responsável somente por autenticação de requisições, solicitação/aprovação de acesso, cargos, suspensão/reativação e auditoria. As ferramentas operacionais e as integrações de IA continuam no frontend.

## Configuração local

1. Use Node.js 22 ou superior e instale as dependências com `pnpm install`.
2. Copie `.env.example` para `.env` e defina as origens permitidas.
3. Configure `GOOGLE_APPLICATION_CREDENTIALS` apontando para uma conta de serviço do projeto Firebase.
4. Defina temporariamente `BOOTSTRAP_OWNER_EMAILS` com o e-mail do primeiro proprietário.
5. Inicie com `pnpm dev`. A porta padrão é `8787`.

O `.env` local desta máquina já foi configurado. Ele fica ignorado pelo Git e referencia a credencial fora do repositório.

## Como iniciar no dia a dia

Abra dois terminais.

No primeiro, inicie o backend:

```powershell
cd C:\Users\maicons\Documents\GitHub\FastSEO_1.0V\backend
pnpm dev
```

O terminal deve informar que o serviço está ouvindo na porta `8787`. Para conferir:

```text
http://localhost:8787/health
```

No segundo terminal, inicie o frontend:

```powershell
cd C:\Users\maicons\Documents\GitHub\FastSEO_1.0V
pnpm dlx serve . --listen 5500
```

Depois acesse:

```text
http://localhost:5500
```

O Python não é necessário. A extensão Live Server do VS Code também pode ser usada, desde que sirva o frontend pela porta `5500`.

## Local versus produção

Localmente, o frontend usa `http://localhost:8787/api`. No GitHub Pages, ele usa o serviço Docker no Render:

```text
https://fastseo-users-backend-maicons.onrender.com/api
```

`window.FASTSEO_BACKEND_URL` continua disponível como override antes de carregar `src/main.js`, caso o serviço seja movido ou receba um domínio próprio.

Não integre esta branch ao `main` antes de o endpoint `/health` responder no Render. O GitHub Pages publica somente o frontend e não executa a pasta `backend/`.

## Implantação no Render Free

O arquivo `render.yaml`, na raiz do repositório, descreve um Web Service gratuito com:

- `Dockerfile` multi-stage, Node 24 e usuário não privilegiado;
- leitura automática da porta definida pelo Render e escuta em `0.0.0.0`;
- verificação de saúde em `/health` e encerramento gracioso em `SIGTERM`;
- CORS restrito a `https://maiconsantossilvah-dot.github.io`;
- limite de 120 requisições por IP a cada 15 minutos nas rotas `/api`, com resposta `429` e cabeçalhos `RateLimit`;
- `BOOTSTRAP_OWNER_EMAILS` vazio em produção;
- credenciais do Firebase em variáveis secretas, nunca dentro da imagem ou do Git.

### Criar o serviço

1. Envie para o GitHub uma branch que contenha `render.yaml`.
2. Acesse o [painel de Blueprints do Render](https://dashboard.render.com/blueprints) e escolha **New Blueprint Instance**.
3. Conecte o repositório `FastSEO_1.0V` e selecione a branch preparada.
4. Confirme o serviço `fastseo-users-backend-maicons` no plano Free.
5. Quando solicitado, preencha as duas variáveis marcadas como secretas:
   - `FIREBASE_CLIENT_EMAIL`: copie somente o valor `client_email` do JSON local da conta de serviço;
   - `FIREBASE_PRIVATE_KEY`: copie somente o valor `private_key`. O valor pode ser colado com várias linhas ou com `\\n`.
6. Crie o Blueprint e aguarde o primeiro deploy terminar.
7. Abra `https://fastseo-users-backend-maicons.onrender.com/health` e confirme a resposta `{"status":"ok"}`.

Não envie o JSON inteiro ao Render, não use a opção de adicioná-lo ao repositório e nunca cole seus valores em commit, issue ou chat. As variáveis `sync: false` fazem o painel pedir os segredos sem gravá-los no `render.yaml`.

O plano gratuito não exige o pré-pagamento do Google Cloud, mas possui limitações: o serviço pode adormecer após ficar sem tráfego e a primeira abertura pode demorar cerca de um minuto. O frontend tenta novamente durante esse despertar. Esse plano é indicado para uso pequeno/testes, não para uma operação crítica com disponibilidade garantida.

### Ordem segura de publicação

1. Faça commit destas mudanças na branch de preparação e envie-a ao GitHub.
2. Crie o Blueprint usando essa branch.
3. Confirme `/health` e verifique que uma requisição sem token para `/api/me` recebe `401`.
4. Entre pela URL de teste e confirme o acesso do owner.
5. Só então integre a branch ao `main`, permitindo que o GitHub Pages use a nova API.
6. Teste login, owner, viewer e uma operação administrativa na URL publicada.

## Rotas

- `POST /api/access-requests`: cria ou retorna a solicitação do usuário autenticado.
- `GET /api/me`: retorna perfil e permissões calculadas pelo backend.
- `GET /api/users`: lista usuários para owner/admin.
- `POST /api/users/:uid/approve`
- `POST /api/users/:uid/reject`
- `PATCH /api/users/:uid/role`
- `POST /api/users/:uid/suspend`
- `POST /api/users/:uid/reactivate`

Todas as rotas recebem `Authorization: Bearer <Firebase ID Token>`. Cargo, status e UID do ator são sempre lidos do token validado e de `users/{uid}`; valores administrativos enviados pelo frontend não são usados como prova de autorização.

## Primeiro owner

`BOOTSTRAP_OWNER_EMAILS` é uma exceção controlada apenas para inicializar a hierarquia. Um e-mail listado que ainda não possua documento será criado como owner ativo. Remova a variável depois que o primeiro owner entrar e confirme o documento no Firestore.

As regras devem ser publicadas somente depois dessa confirmação. Assim, a transição não bloqueia as coleções operacionais antes de a nova hierarquia possuir um owner ativo.

Nesta instalação, `maiconsantossilvah@gmail.com` já foi criado como owner ativo e a variável de bootstrap voltou a ficar vazia.

Os usuários que já estavam na coleção legada e possuíam Firebase UID foram migrados como viewers ativos para preservar a autorização existente sem conceder escrita automaticamente. Promova para collaborator apenas quem realmente precisar criar ou editar dados.

## Firebase CLI e regras

A CLI está instalada localmente no backend. Para autenticar sua conta Google:

```powershell
cd C:\Users\maicons\Documents\GitHub\FastSEO_1.0V\backend
pnpm firebase:login
```

Para publicar somente as regras do Firestore:

```powershell
pnpm deploy:rules
```

O deploy da CLI substitui as regras ativas no Firebase pelas regras locais. Sempre revise `firestore.rules`, confirme que existe um owner ativo e faça um commit antes de executar esse comando.

## Cuidados com credenciais

- Nunca mova o JSON da conta de serviço para dentro do repositório.
- Nunca faça commit de `.env`, chaves privadas, tokens ou arquivos `service-account*.json`.
- A conta de serviço possui acesso privilegiado ao Firestore; não envie o arquivo por chat, e-mail ou mensagens.
- No Render, armazene `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` somente como variáveis secretas.
- Nunca configure `GOOGLE_APPLICATION_CREDENTIALS` com um caminho local no Render; esse arquivo não existe no contêiner.
- Se a chave for exposta, revogue-a imediatamente no Firebase/Google Cloud e gere outra.
- Restrinja `FRONTEND_ORIGINS` aos domínios reais usados pelo frontend.
- Use HTTPS em produção; Firebase ID Tokens não devem trafegar por HTTP fora do ambiente local.
- Depois de alterar permissões ou regras, teste owner, admin, collaborator, viewer e pending.

## Antes do commit

```powershell
git status --short
git diff --check
git diff -- . ':!backend/.env'
```

Confirme que `backend/.env` e o JSON da conta de serviço não aparecem no status. O `.gitignore` já cobre ambos, mas essa revisão manual evita vazamentos acidentais.

## Verificação

```bash
pnpm typecheck
pnpm test
pnpm build
```

Se Docker estiver disponível, valide também a imagem sem copiar a credencial para ela:

```bash
docker build -t fastseo-users-backend .
```
