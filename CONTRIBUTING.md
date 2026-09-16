# Contribuindo

Use Node.js 22+ ou Bun 1.3+.

1. Instale as dependências com `npm ci` ou `bun install --frozen-lockfile`.
2. Faça a alteração em uma branch.
3. Execute `npm run check`, `npm test`, `bun test` e `npm run build`.
4. Descreva o comportamento alterado e a validação no pull request.

Ao alterar dependências, atualize `package-lock.json` com `npm install` e
`bun.lock` com `bun install`. Mantenha a CLI e a API compatíveis com ambos os runtimes.

Os testes usam arquivos temporários e conferem dimensões, transparência, ICO,
preservação dos originais e comportamento da CLI. Novos formatos devem incluir
verificações equivalentes. Não adicione marcas de terceiros sem autorização.

Os fontes e testes são TypeScript em modo estrito. `src/cli.ts` é a entrada
da CLI. `npm run build` gera JavaScript ESM e declarações de tipos em `dist/`.
Mantenha os imports relativos com extensão `.js` para compatibilidade do build
com Node.js; TypeScript, tsx e Bun resolvem os fontes `.ts` no desenvolvimento.
