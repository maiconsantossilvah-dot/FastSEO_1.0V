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

Localmente, o frontend usa `http://localhost:8787/api`. No GitHub Pages, ele usa a URL determinística do serviço `fastseo-users-backend` no Cloud Run, região `southamerica-east1`:

```text
https://fastseo-users-backend-460968097608.southamerica-east1.run.app/api
```

`window.FASTSEO_BACKEND_URL` continua disponível como override antes de carregar `src/main.js`, caso o serviço seja movido ou receba um domínio próprio.

Não publique a integração no `main` antes de o endpoint `/health` responder na URL do Cloud Run. O GitHub Pages publica somente o frontend e não executa a pasta `backend/`.

## Preparação para Cloud Run

O backend inclui:

- `Dockerfile` multi-stage com Node 24 e usuário não privilegiado;
- `.dockerignore` e `.gcloudignore`, que excluem `.env`, logs, dependências e artefatos locais;
- leitura do `PORT` injetado pelo Cloud Run e escuta em `0.0.0.0` dentro do contêiner;
- encerramento gracioso em `SIGTERM`;
- CORS restrito ao GitHub Pages em produção;
- bloqueio de inicialização se `FRONTEND_ORIGINS` estiver vazio ou se `BOOTSTRAP_OWNER_EMAILS` for usado em produção;
- credenciais automáticas por identidade do serviço, sem JSON dentro da imagem.

### Implantar sem administrador local

Use o Google Cloud Shell no navegador. A partir de um clone/branch que contenha estes arquivos:

```bash
cd FastSEO_1.0V/backend
bash deploy-cloud-run.sh
```

O script:

1. seleciona o projeto `fastseo-6a61b`;
2. habilita Cloud Run, Cloud Build e Artifact Registry;
3. cria identidades separadas para build (`fastseo-build`) e execução (`fastseo-backend`), se necessário;
4. concede `roles/run.builder` somente à identidade de build e `roles/datastore.user` somente à identidade de execução;
5. constrói e publica o contêiner em São Paulo;
6. torna o endpoint HTTP público no nível do Cloud Run — as rotas `/api` continuam protegidas pelo Firebase ID Token;
7. limita a escala a três instâncias e valida `/health`.

Não configure `GOOGLE_APPLICATION_CREDENTIALS` nem envie o JSON local para o Cloud Shell/Cloud Run. A identidade vinculada ao serviço fornece as credenciais automaticamente.

O usuário que executar o script precisa de permissões para habilitar APIs, criar/usar conta de serviço, alterar IAM e implantar no Cloud Run. Se algum comando retornar `PERMISSION_DENIED`, a etapa correspondente deve ser autorizada no IAM do projeto; não tente contornar isso adicionando a chave JSON ao repositório.

### Ordem segura de publicação

1. Faça commit destas mudanças em uma branch de preparação.
2. Use essa branch no Cloud Shell e execute `bash deploy-cloud-run.sh`.
3. Confirme que `/health` responde e que uma requisição sem token para `/api/me` recebe `401`.
4. Só então integre a branch ao `main`, permitindo que o GitHub Pages publique o frontend.
5. Teste login, owner, viewer e uma operação administrativa na URL publicada.

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
- Em produção no Google Cloud, prefira credenciais automáticas por IAM em vez de carregar um JSON no servidor.
- No Cloud Run, nunca defina `GOOGLE_APPLICATION_CREDENTIALS`; use a identidade de serviço dedicada.
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
