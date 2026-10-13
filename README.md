# IntegraHub

As verificações de segurança, automação no GitHub e geração segura dos dados fictícios estão documentadas em [SECURITY.md](SECURITY.md).

## Melhorias de outubro de 2026

- Dashboard com períodos de 7, 14 e 30 dias, gráfico diário, taxa de sucesso, tempo médio e links para as últimas falhas. Os contadores de hoje usam o fuso `America/Fortaleza`.
- Integrações com busca por nome/URL, filtros por método/status, última execução e duplicação. Cópias começam inativas e preservam as credenciais no backend, sem expor os valores no navegador.
- Headers e parâmetros podem ser editados como chave/valor ou JSON, com validação junto ao campo. Valores já existentes mantêm seu tipo até serem alterados.
- Execuções e Logs têm filtros de data/hora. Selecione duas execuções da mesma integração para comparar HTTP, duração e diferenças na resposta. A comparação usa os dados mascarados disponíveis no histórico.
- **Automação** permite configurar intervalos de 1 minuto a 7 dias, alertas por falhas consecutivas e lentidão, reconhecer alertas e acompanhar a fila. Alertas são exibidos dentro do sistema.
- **Ambientes** permite separar desenvolvimento, homologação e produção. Variáveis protegidas são reutilizadas com `{{BASE_URL}}`, `{{API_TOKEN}}` etc. na URL, headers, parâmetros e body.

### Atualizar uma instalação existente

Na pasta `backend`, execute:

```bash
npx prisma migrate deploy
npm run prisma:generate
```

Configure `CREDENTIAL_ENCRYPTION_KEY` no `.env` antes de criar ambientes. Gere uma chave com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Guarde essa chave junto aos backups: as variáveis usam AES-256-GCM e uma nova chave não abre valores já salvos. A chave nunca deve ser commitada. Valores aparecem como `********`; manter a máscara preserva o valor e remover a chave do JSON remove a variável. Um ambiente deve pertencer ao mesmo proprietário da integração. Integrações antigas continuam funcionando sem ambiente.

`EXECUTION_CONCURRENCY` define o limite global de chamadas externas simultâneas (padrão 3, máximo 10). A fila fica no PostgreSQL e o worker roda junto à API. Agendamentos dependem da API ligada; após uma interrupção, cada agenda vencida gera no máximo uma execução, sem reproduzir todos os intervalos perdidos. Uma integração com tarefa pendente ou em execução não acumula novas tarefas do agendamento.

Somente GET pode ter até três tentativas extras, com espera progressiva para HTTP 429, 502, 503 e 504. Mutações não são repetidas automaticamente. Tarefas interrompidas são encerradas como erro para evitar repetir uma chamada que pode ter chegado ao destino. Alterar configuração ou credenciais enquanto uma tarefa aguarda cancela a chamada com uma mensagem; execute novamente para usar os novos valores.

### Novos contratos da API

`POST /api/integrations/:id/execute` retorna **202** com a execução `PENDING`. Consulte `GET /api/executions/:id` até obter `SUCCESS` ou `ERROR`. A interface acompanha esse processo automaticamente e indica quando é necessário continuar pelo histórico.

```text
POST /api/integrations/:id/duplicate
GET  /api/dashboard?days=7
GET  /api/executions?from=2026-10-01T00:00:00-03:00&to=2026-10-13T23:59:59-03:00
GET  /api/automation
PUT  /api/automation/integrations/:id
POST /api/automation/alerts/:id/acknowledge
GET  /api/environments
POST /api/environments
PUT  /api/environments/:id
```

As novas rotas exigem sessão e preservam o isolamento por proprietário. Dashboard, lista de ambientes e visão de automação aceitam `ownerId` para administradores. O corpo da configuração de automação é `{ scheduleMinutes, maxRetries, failureThreshold, slowThresholdMs }`, com `scheduleMinutes: null` para desligar. Ambientes recebem `{ name, stage, variables }`, com `stage` igual a `DEVELOPMENT`, `STAGING` ou `PRODUCTION`.

Os testes com `TEST_DATABASE_URL` também validam fila, concorrência, agendamento, retry seguro, alertas, criptografia, variáveis, duplicação, filtros e isolamento das novas rotas. Use um banco de testes dedicado e com todas as migrations aplicadas.

Plataforma de gerenciamento, monitoramento e auditoria de integrações entre sistemas e APIs.

## Objetivo

O IntegraHub centraliza integrações HTTP com contas individuais. Cada usuário vê suas próprias integrações, execuções, logs e eventos de auditoria. Administradores podem consultar todos os dados, gerenciar contas e acompanhar sessões ativas.

## Tecnologias

- Node.js
- Express
- JavaScript
- PostgreSQL
- Prisma ORM
- Axios
- dotenv
- cors
- nodemon
- HTML5
- CSS3
- Bootstrap 5
- jQuery

## Estrutura

```text
integrahub/
|-- backend/
|   |-- prisma/
|   |   |-- migrations/
|   |   `-- schema.prisma
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middlewares/
|   |   |-- repositories/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- utils/
|   |   `-- app.js
|   |-- .env.example
|   |-- package.json
|   `-- server.js
|-- frontend/
|   |-- assets/
|   |   |-- css/style.css
|   |   `-- js/
|   |       |-- api.js
|   |       |-- app.js
|   |       |-- dashboard.js
|   |       |-- activity.js
|   |       |-- audit.js
|   |       |-- auth.js
|   |       |-- login.js
|   |       |-- admin.js
|   |       `-- profile.js
|   |-- login/index.html
|   |-- admin/index.html
|   |-- perfil/index.html
|   |-- dashboard/index.html
|   |-- integracoes/index.html
|   |-- execucoes/index.html
|   |-- logs/index.html
|   |-- auditoria/index.html
|   |-- server.js
|   `-- index.html
`-- README.md
```

## Requisitos

- Node.js 22 ou superior (desenvolvimento usa `node --watch`)
- npm
- PostgreSQL instalado e em execução

## Banco PostgreSQL

Crie o banco:

```sql
CREATE DATABASE integrahub;
```

Opcionalmente, crie um usuário dedicado:

```sql
CREATE USER integrahub_user WITH PASSWORD 'sua_senha';
GRANT ALL PRIVILEGES ON DATABASE integrahub TO integrahub_user;
```

## Instalação

```bash
cd backend
npm install
copy .env.example .env
```

Configure o `backend/.env`:

```env
PORT=3000
HOST=127.0.0.1
FRONTEND_ORIGINS=http://127.0.0.1:5500,http://localhost:5500
DATABASE_URL="postgresql://integrahub_user:sua_senha@localhost:5432/integrahub?schema=public"
INTEGRATION_TIMEOUT_MS=15000
```

### PostgreSQL no Docker Desktop (Windows)

Se outro PostgreSQL já atende `127.0.0.1:5432` no Windows, essa porta leva ao banco do Windows, mesmo com o contêiner publicado em `5432:5432`. Neste ambiente, o contêiner `integrahub-postgres` é acessado pelo encaminhador `integrahub-pg-forward` em `127.0.0.1:55432`. Configure a `DATABASE_URL` do backend com a porta `55432` e as credenciais do contêiner.

Para recriar o encaminhador, com `integrahub-postgres` já iniciado, execute na raiz do projeto em PowerShell (somente se o encaminhador ainda não existir):

```powershell
$forwardPath = (Resolve-Path 'backend/docker/pg-forward.sh').Path
docker run -d --restart unless-stopped --name integrahub-pg-forward `
  --link integrahub-postgres:db -p 127.0.0.1:55432:55432 `
  --mount "type=bind,source=$forwardPath,target=/mnt/forward,readonly" `
  --entrypoint sh postgres:16-alpine `
  -c 'cp /mnt/forward /tmp/forward && chmod +x /tmp/forward && exec nc -lk -p 55432 -e /tmp/forward'
```

O encaminhador usa apenas `127.0.0.1` e não altera o volume do PostgreSQL. Se ele já existir e estiver parado, use `docker start integrahub-pg-forward`.

Execute a migration e gere o Prisma Client:

```bash
npx prisma migrate deploy
npm run prisma:generate
```

Se o banco já tiver exatamente as tabelas, enums, índices e relacionamentos desta migration, mas não tiver `_prisma_migrations`, `migrate deploy` retorna `P3005`. Confirme a equivalência do schema antes de registrar a migration com `npx prisma migrate resolve --applied 20260812143000_init_integrahub_execution`.

Inicie o backend:

```bash
npm run dev
```

Em outro terminal, inicie o frontend:

```bash
cd frontend
npm run dev
```

Abra `http://127.0.0.1:5500` no navegador. A raiz redireciona para o Dashboard e, sem sessão, para `/login/index.html`. O frontend usa a API na porta `3000` do mesmo host aberto no navegador; as bibliotecas visuais são carregadas por CDN.

### Primeiro acesso e usuários

1. Abra `http://127.0.0.1:5500/login/index.html` **no computador que executa a API**.
2. Se ainda não houver usuários, a tela apresenta **Criar administrador inicial**. Informe e-mail e senha de 12 a 128 caracteres. Essa criação só é aceita pela API a partir de `127.0.0.1` e apenas enquanto não existir nenhum usuário.
3. Entre em **Administração** para criar contas de usuário ou outros administradores. Não existe cadastro público depois do primeiro administrador.
4. Cada pessoa entra com a própria conta. Usuários comuns acessam somente registros cujo proprietário é sua conta. O administrador pode ver todos os registros ou filtrar por usuário nos links da página Administração. Em **Minha conta**, cada pessoa pode trocar a própria senha informando a senha atual.

As integrações que já existiam antes da migration de usuários têm proprietário nulo. Elas continuam visíveis apenas para administradores, sem serem atribuídas artificialmente a uma pessoa. O primeiro administrador pode consultá-las, editá-las e executá-las.

A sessão usa cookie `HttpOnly` com `SameSite=Strict`, token aleatório armazenado como hash no banco e validade de sete dias. **Usuários logados** têm ao menos uma sessão válida sem logout; **usuários online** tiveram atividade nos últimos 15 minutos. Uma pessoa pode ter várias sessões abertas. Desativar uma conta ou redefinir sua senha encerra as sessões existentes. As senhas são armazenadas com `scrypt` e nunca são retornadas pela API.

Cada item do menu tem sua própria página:

- Dashboard (`/dashboard/index.html`): indicadores com atalhos para as demais páginas.
- Integrações (`/integracoes/index.html`): cadastro, edição, execução e histórico por integração.
- Execuções (`/execucoes/index.html`): histórico geral, filtro por integração/status, paginação e detalhes de request/response.
- Logs (`/logs/index.html`): execuções com status `ERROR`, filtro por integração, paginação e detalhes do erro. Não é um log geral do processo Node.
- Auditoria (`/auditoria/index.html`): eventos persistidos de cadastro, edição, início/fim de execução e recuperação de execuções interrompidas, com filtros, autor e paginação.
- Administração (`/admin/index.html`, somente administradores): usuários, sessões ativas, criação/desativação de contas, perfis, redefinição de senha e links para os dados de cada usuário.

## Endpoints

```text
GET  /api/health
GET  /api/auth/setup-status
POST /api/auth/setup
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
POST /api/auth/change-password
GET  /api/dashboard
GET  /api/integrations
POST /api/integrations
GET  /api/integrations/:id
PUT  /api/integrations/:id
POST /api/integrations/:id/execute
GET  /api/integrations/:id/executions
GET  /api/executions?page=1&pageSize=20&status=ERROR&integrationId=1
GET  /api/executions/:id
GET  /api/audit?page=1&pageSize=20&action=EXECUTION_FINISHED&integrationId=1
GET  /api/admin/users?page=1&pageSize=20
POST /api/admin/users
PATCH /api/admin/users/:id
POST /api/admin/users/:id/reset-password
```

`/api/health`, `/api/auth/setup-status`, `/api/auth/setup` e `/api/auth/login` são públicos; as demais rotas exigem sessão. As rotas `/api/admin/*` exigem perfil `ADMIN`. Dashboard, integrações, execuções e auditoria aceitam `ownerId` como filtro apenas para administradores. Um usuário comum recebe `403` se tentar pedir dados de outra conta e `404` para IDs de registros que não lhe pertencem.

## Cadastro de integração

Campos disponíveis:

- Nome
- Descrição
- URL
- Método: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Status: `ACTIVE` ou `INACTIVE`
- Headers em JSON
- Query Params em JSON
- Body em JSON

Exemplo GET:

```json
{
  "name": "Consultar usuários",
  "description": "Consulta usuários da API de testes",
  "baseUrl": "https://jsonplaceholder.typicode.com/users",
  "method": "GET",
  "headers": {
    "Accept": "application/json"
  },
  "queryParams": {},
  "body": null
}
```

Exemplo GET com parâmetro:

```json
{
  "name": "Posts do usuário 1",
  "baseUrl": "https://jsonplaceholder.typicode.com/posts",
  "method": "GET",
  "queryParams": {
    "userId": 1
  }
}
```

Exemplo POST:

```json
{
  "name": "Criar post",
  "description": "Teste de criação de registro",
  "baseUrl": "https://jsonplaceholder.typicode.com/posts",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "queryParams": {},
  "body": {
    "title": "Teste IntegraHub",
    "body": "Minha primeira integração",
    "userId": 1
  }
}
```

## Execução

A execução sempre acontece no backend:

```text
Frontend -> IntegraHub Backend -> API externa -> IntegraHub Backend -> PostgreSQL -> Frontend
```

Ao clicar em `Executar`, o backend:

- busca a integração;
- valida se existe e está `ACTIVE`;
- registra uma execução `PENDING` e uma tarefa persistida na fila;
- retorna HTTP 202 para a interface, que consulta o andamento;
- o worker marca a execução `RUNNING` quando há uma vaga disponível;
- executa a chamada com Axios;
- mede a duração;
- salva HTTP status, snapshot mascarado do request, response e erro quando houver;
- disponibiliza o resultado no endpoint de detalhes para o frontend.

Status HTTP de `200` até `299` são `SUCCESS`. Outros status, como `404` ou `500`, são registrados como `ERROR` sem derrubar a aplicação.

## Timeout

O timeout padrão é `15000 ms`, configurado por `INTEGRATION_TIMEOUT_MS`; valores maiores que `30000 ms` são limitados a `30000 ms`:

```env
INTEGRATION_TIMEOUT_MS=15000
```

Em timeout, a execução é registrada como `ERROR`, com mensagem:

```text
Timeout ao executar integração.
```

## Headers sensíveis

Os seguintes headers são tratados como sensíveis nas respostas da API e no snapshot da execução:

```text
Authorization
Proxy-Authorization
X-API-Key
Api-Key
Cookie
Set-Cookie
```

Eles são mascarados como:

```json
{
  "Authorization": "********"
}
```

Por segurança, outros headers também são mascarados, exceto `Accept`, `Content-Type`, `User-Agent`, `Accept-Language` e `Cache-Control`.

## Histórico

Use o botão `Histórico` na tabela de integrações para consultar as execuções, em páginas de 20 registros. A API aceita `page` (a partir de 1) e `pageSize` (1 a 100), retornando `{ items, total, page, pageSize }`. O botão `Detalhes` mostra:

- integração;
- status;
- HTTP status;
- URL;
- método;
- headers;
- query params;
- body enviado;
- response;
- erro;
- início;
- fim;
- duração.

A página Execuções lista as integrações visíveis à conta atual e aceita filtros opcionais `status` (`PENDING`, `RUNNING`, `SUCCESS`, `ERROR`) e `integrationId`. A página Logs usa o mesmo endpoint com `status=ERROR` e mostra as mensagens de erro registradas. Ambas usam paginação no servidor e o endpoint de detalhes existente.

## Auditoria

A migration `20260929190000_audit_events` cria a tabela `AuditEvent`. Cadastros e edições de integração, assim como início e finalização de execução, gravam evento na mesma transação da operação principal. Uma execução `RUNNING` recuperada como erro também gera evento. O endpoint `/api/audit` aceita `page`, `pageSize`, `action` e `integrationId`.

No momento da migration, integrações e execuções antigas receberam eventos `INTEGRATION_EXISTING` e `EXECUTION_EXISTING`. Esses eventos indicam que os registros já estavam no banco; não afirmam quando nem por quem foram criados. A migration de usuários adiciona o `actorId` aos novos eventos. Os eventos não guardam headers, URL, parâmetros ou body.

## Testes manuais

Fluxo principal:

1. Entre em `http://127.0.0.1:5500/login/index.html` e abra Integrações.
2. Cadastre uma integração:
   - Nome: `Consultar usuários`
   - URL: `https://jsonplaceholder.typicode.com/users`
   - Método: `GET`
   - Headers: `{"Accept":"application/json"}`
3. Salve.
4. Clique em `Executar`.
5. Confirme a execução.
6. Verifique HTTP `200`, duração e response no modal.
7. Abra `Histórico`.
8. Clique em `Detalhes`.
9. Confira request, response, HTTP status e duração.

Teste com erro:

```text
https://jsonplaceholder.typicode.com/url-que-nao-existe
```

Essa chamada deve registrar `ERROR`, HTTP `404` e response da API externa, sem derrubar o backend.

## Limites e proteção de dados

- O backend aceita somente destinos HTTP/HTTPS públicos. Endereços locais, privados e reservados são bloqueados; o DNS é verificado antes da chamada e na conexão. Até cinco redirecionamentos dentro da mesma origem são aceitos, com validação de cada novo destino. Redirecionamentos para outra origem são bloqueados para evitar o encaminhamento de headers e body.
- O timeout padrão é 15 segundos e o máximo permitido é 30 segundos, incluindo os redirecionamentos. O tamanho da resposta e do request enviado é limitado a 1 MB.
- Headers fora de uma pequena lista de headers públicos são mascarados como `********` nas respostas da API e no histórico persistido. Valores de query params e da query da URL também são mascarados. Campos de JSON com nomes como `token`, `secret` e `password` são mascarados no body e na response. A configuração original da integração permanece no banco para permitir a execução. Ao editar uma integração, manter `********` preserva o valor anterior.
- Segredos em caminhos de URL, valores sob nomes inesperados ou texto livre da response não podem ser reconhecidos com segurança por essa máscara. Evite colocá-los nesses locais. Mesmo administradores veem os campos sensíveis mascarados nas respostas; senhas e hashes não são exibidos.
- A API e o frontend escutam apenas `127.0.0.1` por padrão. Para publicar em outra máquina, configure HTTPS, origem permitida em `FRONTEND_ORIGINS`, endereço da API no frontend e as regras de rede antes de expor o serviço. Não exponha a configuração inicial sem proteção.
- Execuções `RUNNING` com mais de dois minutos são marcadas como `ERROR` na inicialização e a cada minuto. Se uma gravação falhar, o endpoint ainda pode retornar erro 500.

## Testes

Execute `npm test` em `backend` para as validações locais. Para executar também o fluxo com PostgreSQL, configure `TEST_DATABASE_URL` com a URL de um **banco de testes já migrado** antes de rodar `npm test`. O teste cria administrador e usuário temporários, verifica login, isolamento por proprietário, permissões administrativas, sessão, HTTP 200/404, logs e auditoria, e remove os registros ao terminar; ele não depende da disponibilidade de uma API externa.
