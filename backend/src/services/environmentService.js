const prisma = require('../config/prisma');
const { ownerWhere } = require('../utils/accessScope');
const { AppError } = require('../utils/AppError');
const vault = require('../utils/secretVault');
const { validateDestinationUrl } = require('../utils/urlValidator');
function publicEnvironment(item) {
  const variables = vault.decryptVariables(item.encryptedVariables);
  return { id: item.id, name: item.name, stage: item.stage, ownerId: item.ownerId, variables: Object.fromEntries(Object.keys(variables).map(key => [key, '********'])) };
}
async function list(user, ownerId) {
  return (await prisma.environment.findMany({ where: ownerWhere(user, ownerId), orderBy: { name: 'asc' } })).map(publicEnvironment);
}
async function save(id, payload, user) {
  const previous = id ? await prisma.environment.findFirst({ where: { id: Number(id), ...ownerWhere(user) } }) : null;
  if (id && !previous) throw new AppError('Ambiente não encontrado.', 404);
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name || name.length > 100) throw new AppError('Nome do ambiente obrigatório (até 100 caracteres).', 400);
  if (!['DEVELOPMENT', 'STAGING', 'PRODUCTION'].includes(payload.stage)) throw new AppError('Tipo de ambiente inválido.', 400);
  if (!payload.variables || typeof payload.variables !== 'object' || Array.isArray(payload.variables)) throw new AppError('Variáveis devem ser um objeto.', 400);
  const old = previous ? vault.decryptVariables(previous.encryptedVariables) : {};
  const variables = {};
  if (Object.keys(payload.variables).length > 100) throw new AppError('Limite de 100 variáveis.', 400);
  for (const [key, value] of Object.entries(payload.variables)) {
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(key) || typeof value !== 'string' || value.length > 8192) throw new AppError('Use nomes como API_TOKEN e valores de texto com até 8192 caracteres.', 400);
    if (value === '********' && !Object.hasOwn(old, key)) throw new AppError('Informe o valor inicial da variável.', 400);
    variables[key] = value === '********' ? old[key] : value;
  }
  const data = { name, stage: payload.stage, encryptedVariables: vault.encryptVariables(variables) };
  try {
    const saved = previous ? await prisma.environment.update({ where: { id: previous.id }, data }) : await prisma.environment.create({ data: { ...data, ownerId: user.id } });
    return publicEnvironment(saved);
  } catch (error) { if (error.code === 'P2002') throw new AppError('Já existe um ambiente com esse nome.', 409); throw error; }
}
async function resolveIntegration(integration) {
  if (!integration.environmentId) {
    if (/\{\{[A-Z][A-Z0-9_]*\}\}/.test(JSON.stringify([integration.baseUrl, integration.headers, integration.queryParams, integration.body]))) throw new AppError('Selecione um ambiente para usar variáveis.', 400);
    return { request: integration, variables: {} };
  }
  const environment = await prisma.environment.findUnique({ where: { id: integration.environmentId } });
  if (!environment || environment.ownerId !== integration.ownerId) throw new AppError('O ambiente deve pertencer ao proprietário da integração.', 400);
  const variables = vault.decryptVariables(environment.encryptedVariables);
  const request = { ...integration };
  for (const field of ['baseUrl', 'headers', 'queryParams', 'body']) request[field] = vault.interpolate(integration[field], variables);
  if (!validateDestinationUrl(request.baseUrl)) throw new AppError('O ambiente resolveu para uma URL não permitida.', 400);
  return { request, variables };
}
async function validateBinding(data, ownerId) {
  if (data.environmentId && !await prisma.environment.findFirst({ where: { id: data.environmentId, ownerId } })) throw new AppError('Ambiente inválido para o proprietário.', 400);
  await resolveIntegration({ ...data, ownerId });
}
module.exports = { list, save, resolveIntegration, validateBinding };
