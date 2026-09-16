#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { convertProject, listProjects } from './converter.js';

const HELP = `Brand Generator — conversor de marcas PNG/SVG

Uso:
  brand-generator convert [projeto] [--root projetos] [--only all|1024|web]

Sem nome de projeto, converte todas as subpastas de projetos/.
Os caminhos são relativos à pasta atual. Originais são preservados.

Opções:
  --root <pasta>   Pasta que contém os projetos (padrão: projetos)
  --only <tipo>    Gerar all, 1024 ou web (padrão: all)
  -h, --help      Exibir ajuda
  -v, --version   Exibir versão

Exemplos:
  bun run convert
  bun run convert minha-marca
  npm run convert -- minha-marca --only web
  bun src/cli.ts convert --root ./outras-marcas
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: 'string', default: 'projetos' },
      only: { type: 'string', default: 'all' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
  if (values.help || (!positionals.length && !values.version)) return console.log(HELP);
  if (values.version) {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    return console.log(pkg.version);
  }
  const [command, project, ...extra] = positionals;
  if (command !== 'convert' || extra.length) throw new Error('Comando inválido. Use convert [projeto] ou --help.');
  const only = values.only;
  if (only !== 'all' && only !== '1024' && only !== 'web') throw new Error('--only deve ser all, 1024 ou web.');
  if (project && (project === '.' || project === '..' || /[/\\]/.test(project))) {
    throw new Error('Informe somente o nome do projeto; use --root para escolher outra pasta.');
  }
  const root = path.resolve(values.root);
  let projects;
  try { projects = project ? [project] : await listProjects(root); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') throw new Error(`Pasta não encontrada: ${root}. Crie projetos/<nome> e adicione seus PNG/SVG.`);
    throw error;
  }
  if (!projects.length) return console.log(`Nenhum projeto em ${root}. Crie uma subpasta e adicione PNG/SVG.`);
  let count = 0;
  for (const name of projects) {
    try {
      const result = await convertProject(path.join(root, name), { only });
      for (const warning of result.warnings) console.warn(`[${name}] Aviso: ${warning}`);
      console.log(`[${name}] ${result.files.length} arquivo(s) gerado(s).`);
      count += result.files.length;
    } catch (error) {
      console.error(`[${name}] Erro: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
  console.log(`Conversão ${process.exitCode ? 'finalizada com erros' : 'concluída'}: ${count} arquivo(s).`);
}

main().catch((error: unknown) => {
  console.error(`Erro: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
