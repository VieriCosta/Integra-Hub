const dns = require("node:dns");
const net = require("node:net");
const { AppError } = require("./AppError");

const blockedV4 = new net.BlockList();
const blockedV6 = new net.BlockList();
for (const [range, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]
]) blockedV4.addSubnet(range, prefix, "ipv4");
for (const [range, prefix] of [
  ["::", 128], ["::1", 128], ["::ffff:0:0", 96],
  ["64:ff9b::", 96], ["64:ff9b:1::", 48],
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]
]) blockedV6.addSubnet(range, prefix, "ipv6");

function hostnameOf(url) {
  return url.hostname.replace(/^\[|\]$/g, "");
}

function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return !blockedV4.check(address, "ipv4");
  if (family === 6) return address.toLowerCase().startsWith("2") && !blockedV6.check(address, "ipv6");
  return false;
}

function validateDestinationUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const hostname = hostnameOf(url);
    return ["http:", "https:"].includes(url.protocol) && !!hostname &&
      !url.username && !url.password && !url.hash &&
      !/(^|\.)(localhost|local|internal)$/.test(hostname.toLowerCase()) &&
      (!net.isIP(hostname) || isPublicAddress(hostname));
  } catch {
    return false;
  }
}

async function assertSafeDestination(value, timeoutMs = 30000) {
  if (!validateDestinationUrl(value)) {
    throw new AppError("Destino HTTP inválido ou não permitido.", 400);
  }
  const hostname = hostnameOf(new URL(value));
  if (net.isIP(hostname)) return;
  let addresses;
  let timer;
  try {
    addresses = await Promise.race([
      dns.promises.lookup(hostname, { all: true }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" })), timeoutMs);
      })
    ]);
  } catch (error) {
    if (error.code === "ETIMEDOUT") throw error;
    throw new AppError("Não foi possível resolver o destino HTTP.", 400);
  } finally {
    clearTimeout(timer);
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new AppError("Destino HTTP privado ou reservado não permitido.", 400);
  }
}

function secureLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      return callback(new Error("Destino HTTP privado ou reservado não permitido."));
    }
    const selected = addresses.find(({ family }) => !options.family || options.family === family);
    if (!selected) return callback(new Error("Família IP indisponível para o destino."));
    return options.all ? callback(null, addresses) : callback(null, selected.address, selected.family);
  });
}

module.exports = { validateDestinationUrl, assertSafeDestination, secureLookup, isPublicAddress };
