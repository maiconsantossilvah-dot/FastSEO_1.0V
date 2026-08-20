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
py -m http.server 5500
```

Depois acesse:

```text
http://localhost:5500
```

Se `py` não estiver disponível, use a extensão Live Server do VS Code ou outro servidor estático na porta `5500`.

## Local versus produção

Esta instalação deixa o backend pronto para desenvolvimento local. Para publicar o novo frontend, o backend também precisa estar hospedado em uma URL HTTPS pública.

Em produção, o frontend usa `/api` no mesmo domínio por padrão. Isso exige um proxy/rewrite para o backend. Como alternativa, defina `window.FASTSEO_BACKEND_URL` antes de carregar `src/main.js` com a URL pública escolhida.

Não publique o novo frontend em produção antes de definir esse destino. Sem o backend acessível, o login mostrará que o serviço de usuários está indisponível.

Em produção, use credenciais de ambiente/IAM e HTTPS. O frontend usa `/api` no mesmo domínio; para outro endereço, defina `window.FASTSEO_BACKEND_URL` antes de carregar `src/main.js`.

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
