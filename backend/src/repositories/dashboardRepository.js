const prisma = require("../config/prisma");

async function countIntegrations(where = {}) {
  return prisma.integration.count({ where });
}

module.exports = {
  countIntegrations
};
