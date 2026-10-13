const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');

function inspectFile(name, contents) {
  const findings = [];
  const normalized = name.replaceAll('\\', '/');
  if (/(^|\/)\.env(?:\.|$)/.test(normalized) && !normalized.endsWith('.env.example')) findings.push('arquivo de ambiente privado');
  if (/(^|\/)(?:\.aws|\.tmp|node_modules|pgdata)\//.test(normalized) || /\.(?:dump|backup|pem|key|p12|pfx|sql\.gz)$/i.test(normalized)) findings.push('arquivo privado, backup ou chave');
  const signatures = [
    ['chave privada', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
    ['token GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
    ['chave AWS', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ['chave do cofre', /^\s*CREDENTIAL_ENCRYPTION_KEY\s*=\s*["']?[A-Za-z0-9+/]{42,}={0,2}/m],
    ['credencial em URL', /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/:]+:([^\s@]+)@/g]
  ];
  for (const [label, pattern] of signatures) {
    if (label === 'credencial em URL') {
      const matches = [...contents.matchAll(pattern)];
      if (matches.some(match => !/^(?:sua_senha|troque_a_senha|password|test|postgres|ci-only-password)$/.test(match[1]))) findings.push(label);
    } else if (pattern.test(contents)) findings.push(label);
  }
  return findings;
}
function main() {
  // Include staged additions and new workspace files; never read ignored .env or temporary data.
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root }).toString('utf8').split('\0').filter(Boolean);
  const tracked = new Set(execFileSync('git', ['ls-files', '-z', '--cached'], { cwd: root }).toString('utf8').split('\0').filter(Boolean));
  let failures = 0;
  for (const name of new Set(files)) {
    const absolute = path.resolve(root, name);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const findings = inspectFile(name, fs.readFileSync(absolute, 'utf8'));
    if (tracked.has(name)) {
      const staged = execFileSync('git', ['show', `:${name}`], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      findings.push(...inspectFile(name, staged));
    }
    if (findings.length) { failures++; console.error(`${name}: ${[...new Set(findings)].join(', ')}`); }
  }
  if (failures) process.exitCode = 1;
  else console.log(`Verificação concluída: ${new Set(files).size} arquivos, nenhum padrão de segredo ou arquivo privado detectado.`);
}
if (require.main === module) main();
module.exports = { inspectFile };
