# Segurança do IntegraHub

## Verificação antes de enviar alterações

Na pasta `backend`:

```bash
npm ci --include=dev
npm run security:check
npm audit --audit-level=moderate
npm test
```

Na pasta `frontend`, execute `npm test`. Para validar o fluxo completo do backend, configure `TEST_DATABASE_URL` com um banco de testes dedicado e migrado. Os testes nunca devem usar o banco com contas e dados reais.

A verificação local analisa arquivos rastreados, adicionados ao stage e novos arquivos não ignorados. Ela bloqueia arquivos `.env`, backups e chaves privadas, além de padrões conhecidos de tokens e credenciais em URLs. As mensagens mostram o caminho e o tipo de problema, sem imprimir os valores. Essa detecção por padrões não identifica todo tipo possível de segredo.

O workflow `.github/workflows/security.yml` executa essas verificações em pushes para `main`, pull requests e execução manual. Ele usa um PostgreSQL temporário, permissões somente de leitura e actions fixadas por commit. O Dependabot verifica atualizações de dependências e actions semanalmente. Configure o check `Security and tests / verify` como obrigatório na proteção da branch para impedir merges quando houver falhas; adicionar o workflow não ativa essa regra automaticamente.

## Proteções implementadas

A revisão de outubro de 2026 atualizou as dependências afetadas pelos avisos oficiais de [Axios](https://github.com/axios/axios/security/advisories/GHSA-r4gj-5m52-g5wh) e [proxy-addr](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h). O desenvolvimento usa o modo watch nativo do Node para evitar a cadeia de dependências do nodemon.

- Sessões com token aleatório, hash no banco e cookie HttpOnly, SameSite=Strict e Secure em produção.
- Senhas com scrypt e isolamento por proprietário nas integrações, ambientes, execuções e alertas.
- Limite de login por IP e por combinação de IP/conta, reservado antes da validação assíncrona da senha. A memória do limitador tem capacidade máxima; o limite é por processo da API.
- Destinos HTTP privados, locais e reservados bloqueados, incluindo validação DNS na conexão. Redirecionamentos entre origens são recusados.
- Limites de tamanho e timeout; fila com concorrência limitada e retry automático apenas para GET em erros transitórios.
- Variáveis dos ambientes criptografadas com AES-256-GCM. A chave fica no ambiente de execução, fora do Git.
- Headers e campos sensíveis mascarados; valores conhecidos das variáveis também são removidos de respostas que os repetem.
- Respostas da API sem cache, sem divulgação do Express e com cabeçalhos de proteção. Erros inesperados não registram body, SQL ou credenciais nos logs.
- Frontend com CSP e bloqueio de arquivos privados e caminhos fora da raiz, inclusive por links simbólicos.

## Dados de demonstração

O script versionado `backend/scripts/seed-demo.js` contém apenas dados fictícios. Ele não contém a senha da conta de teste nem a chave de criptografia. O banco, seus volumes e o arquivo `.env` não são enviados ao GitHub.

Depois de criar uma conta de perfil USER com e-mail terminado em `@integrahub.local`, execute na pasta `backend`:

```bash
npm run seed:demo -- --email=teste@integrahub.local --allow-demo-data
```

O script exige a opção explícita, recusa produção, administradores e contas inativas, e cria registros apenas no proprietário indicado. Os cadastros usam `[Demo]`, o histórico indica respostas simuladas, nenhuma chamada externa é feita e nenhum agendamento ativo é criado. Repetir o comando preserva os registros existentes. Execuções manuais dessas integrações usam uma API pública de testes.

## Operação

Preserve `CREDENTIAL_ENCRYPTION_KEY` junto aos backups protegidos para conseguir abrir as variáveis já salvas. Credenciais preenchidas diretamente na configuração de uma integração ainda ficam no banco original; use os ambientes para valores que precisam de criptografia em repouso.

Para disponibilizar fora do computador local, configure HTTPS, `NODE_ENV=production`, origens permitidas e os destinos da CSP, e desative as contas de demonstração. A criação do administrador inicial continua restrita ao computador da API.

Relate vulnerabilidades por um canal privado do responsável pelo repositório. Não publique senhas, chaves ou informações de usuários em issues públicas.
