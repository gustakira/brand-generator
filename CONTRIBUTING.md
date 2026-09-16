# Contribuindo

Use Bun 1.3+.

1. Instale as dependências com `bun install --frozen-lockfile`.
2. Faça a alteração em uma branch.
3. Execute `bun run check`, `bun test` e `bun run build`.
4. Descreva o comportamento alterado e a validação no pull request.

Ao alterar dependências, atualize `bun.lock` com `bun install`.
Use Bun para instalação, execução, testes e build.

Os testes usam arquivos temporários e conferem dimensões, transparência, ICO,
preservação dos originais e comportamento da CLI. Novos formatos devem incluir
verificações equivalentes. Não adicione marcas de terceiros sem autorização.

Os fontes e testes são TypeScript em modo estrito. `src/cli.ts` é a entrada
da CLI. `bun run build` gera JavaScript ESM e declarações de tipos em `dist/`.
Mantenha os imports relativos com extensão `.js` para o build;
TypeScript e Bun resolvem os fontes `.ts` no desenvolvimento.
