const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const prisma = require('../src/config/prisma');
const { encryptVariables } = require('../src/utils/secretVault');
const { sanitizeExecution } = require('../src/utils/headerMasker');

function validateDemoTarget(user, { email, allowDemoData }, nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv === 'production') throw new Error('Demo seeding is blocked in production.');
  if (!allowDemoData || !email || !email.endsWith('@integrahub.local')) throw new Error('Use --allow-demo-data --email=NAME@integrahub.local.');
  if (!user?.isActive || user.email !== email || user.role !== 'USER') throw new Error('Target must be an existing active demo USER account.');
}
async function seedDemo({ email, allowDemoData }) {
  if (process.env.NODE_ENV === 'production' || !allowDemoData || !email?.endsWith('@integrahub.local')) validateDemoTarget(null, { email, allowDemoData });
  const user = await prisma.user.findUnique({ where: { email } });
  validateDemoTarget(user, { email, allowDemoData });
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' }) + 'T00:00:00-03:00');
  const now = new Date();
  const definitions = [
    ['CRM — Clientes', 'GET', '/users', 'DEVELOPMENT', { clientes: [{ id: 101, nome: 'Ana Oliveira', empresa: 'Aurora Comércio' }, { id: 102, nome: 'Bruno Lima', empresa: 'Horizonte Digital' }] }],
    ['ERP — Catálogo de produtos', 'GET', '/posts', 'STAGING', { produtos: [{ sku: 'PRD-001', nome: 'Monitor 24 polegadas', preco: 899.9 }, { sku: 'PRD-002', nome: 'Teclado sem fio', preco: 149.9 }] }],
    ['Pedidos — Criar venda', 'POST', '/posts', 'STAGING', { pedidoId: 'PED-2026-1042', cliente: 'Ana Oliveira', total: 1049.8, situacao: 'APROVADO' }],
    ['Estoque — Consulta de saldo', 'GET', '/todos', 'PRODUCTION', { estoque: [{ sku: 'PRD-001', saldo: 32 }, { sku: 'PRD-002', saldo: 87 }] }],
    ['Financeiro — Emitir cobrança', 'POST', '/posts', 'PRODUCTION', { cobrancaId: 'COB-4821', valor: 1049.8, vencimento: '2026-11-10', situacao: 'PENDENTE' }],
    ['Notificações — Confirmação de pedido', 'POST', '/posts', 'DEVELOPMENT', { mensagemId: 'MSG-7782', destinatario: 'ana@example.test', entregue: true }],
    ['Monitoramento — Serviço indisponível', 'GET', '/posts/999999', 'STAGING', { servico: 'API de demonstração', disponivel: false }],
    ['Legado — Sincronização pausada', 'GET', '/users', 'DEVELOPMENT', { importados: 24, ignorados: 2 }]
  ];
  await prisma.$transaction(async tx => {
    const environments = {};
    for (const [stage, name] of [['DEVELOPMENT', 'Desenvolvimento'], ['STAGING', 'Homologação'], ['PRODUCTION', 'Produção']]) {
      environments[stage] = await tx.environment.upsert({ where: { ownerId_name: { ownerId: user.id, name: `[Demo] ${name}` } }, update: {}, create: { ownerId: user.id, name: `[Demo] ${name}`, stage, encryptedVariables: encryptVariables({ BASE_URL: 'https://jsonplaceholder.typicode.com', API_TOKEN: `demo-token-ficticio-${stage.toLowerCase()}`, EMPRESA: 'IntegraHub Demonstração' }) } });
    }
    for (let index = 0; index < definitions.length; index++) {
      const [label, method, endpoint, stage, response] = definitions[index];
      const name = `[Demo] ${label}`;
      if (await tx.integration.findFirst({ where: { ownerId: user.id, name } })) continue;
      const createdAt = new Date(today.getTime() - 29 * 86400000);
      const integration = await tx.integration.create({ data: {
        name, ownerId: user.id, environmentId: environments[stage].id, method,
        baseUrl: `{{BASE_URL}}${endpoint}`,
        description: 'Demonstração com dados fictícios e histórico simulado. As respostas históricas foram geradas sem chamadas externas. Execuções manuais usam a API pública de testes JSONPlaceholder.',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer {{API_TOKEN}}' },
        queryParams: method === 'GET' ? { _limit: 10 } : {},
        ...(method === 'POST' ? { body: { title: 'Pedido fictício', body: 'Demonstração IntegraHub', userId: 1 } } : {}),
        status: index === 7 ? 'INACTIVE' : 'ACTIVE', createdAt,
        failureThreshold: 3, slowThresholdMs: 3000, maxRetries: method === 'GET' ? 1 : 0
      } });
      await tx.auditEvent.create({ data: { integrationId: integration.id, actorId: user.id, action: 'INTEGRATION_CREATED', createdAt } });
      const iterations = index === 7 ? 15 : 30;
      for (let day = 0; day < iterations; day++) {
        const date = new Date(today.getTime() - (29 - day) * 86400000 + (9 + index % 6) * 3600000 + index * 120000);
        // Keep today's simulated events in the past, even when seeded early in the morning.
        const startedAt = date > now ? new Date(now.getTime() - (20 - index) * 60000) : date;
        const failed = index === 6 ? day >= 26 || day % 4 === 0 : (day + index * 3) % 13 === 0;
        const slow = index === 3 && day >= 27;
        const durationMs = slow ? 4600 + day * 20 : 180 + ((day * 79 + index * 137) % 1100);
        const finishedAt = new Date(startedAt.getTime() + durationMs);
        const status = failed ? 'ERROR' : 'SUCCESS';
        const httpStatus = failed ? (index === 6 ? 503 : day % 2 ? 429 : 500) : method === 'POST' ? 201 : 200;
        const execution = await tx.integrationExecution.create({ data: {
          integrationId: integration.id, status, httpStatus, durationMs, createdAt: startedAt, startedAt, finishedAt,
          ...sanitizeExecution({ requestUrl: `https://jsonplaceholder.typicode.com${endpoint}`, requestMethod: method, requestHeaders: integration.headers, requestQueryParams: integration.queryParams, requestBody: integration.body }),
          responseBody: { demonstracao: true, ...(failed ? { mensagem: 'Falha fictícia para demonstração', codigo: httpStatus } : { ...response, sequencia: day + 1, sincronizados: 10 + day }) },
          errorMessage: failed ? `[Simulado] API retornou HTTP ${httpStatus}.` : null
        } });
        await tx.executionJob.create({ data: { integrationId: integration.id, executionId: execution.id, actorId: user.id, state: 'DONE', attempts: failed && method === 'GET' ? 2 : 1, runAt: startedAt, claimedAt: startedAt, finishedAt, createdAt: startedAt } });
        await tx.auditEvent.create({ data: { integrationId: integration.id, executionId: execution.id, actorId: user.id, action: 'EXECUTION_FINISHED', status, httpStatus, durationMs, createdAt: finishedAt } });
      }
      if (index === 6 || index === 3) await tx.integrationAlert.create({ data: { integrationId: integration.id, kind: index === 6 ? 'FAILURES' : 'SLOW', message: index === 6 ? '[Simulado] 3 falhas consecutivas no serviço de demonstração.' : '[Simulado] Tempo de resposta de 5180 ms, acima do limite de 3000 ms.' } });
    }
  }, { timeout: 60000 });
  const integrations = await prisma.integration.findMany({ where: { ownerId: user.id, name: { startsWith: '[Demo]' } }, select: { id: true } });
  const ids = integrations.map(item => item.id);
  console.log(JSON.stringify({ conta: user.email, integracoes: ids.length, ambientes: await prisma.environment.count({ where: { ownerId: user.id } }), execucoes: await prisma.integrationExecution.count({ where: { integrationId: { in: ids } } }), alertas: await prisma.integrationAlert.count({ where: { integrationId: { in: ids } } }), eventosAuditoria: await prisma.auditEvent.count({ where: { integrationId: { in: ids } } }) }));
}
if (require.main === module) {
  const args = process.argv.slice(2);
  const email = args.find(arg => arg.startsWith('--email='))?.slice(8).trim().toLowerCase();
  seedDemo({ email, allowDemoData: args.includes('--allow-demo-data') }).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
module.exports = { seedDemo, validateDemoTarget };
