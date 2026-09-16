import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { convertProject } from '../src/converter.js';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const svg = (width = 64, height = 64) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#ff0000"/></svg>`;

async function fixture(t: TestContext, name = 'marca') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brand-generator-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, name);
  await mkdir(directory);
  return { root, directory };
}

async function dimensions(file: string | Buffer, width: number, height: number, format: string) {
  const metadata = await sharp(file).metadata();
  const label = typeof file === 'string' ? file : 'Imagem em memória';
  assert.equal(metadata.width, width, label);
  assert.equal(metadata.height, height, label);
  assert.equal(metadata.format, format, label);
}

test('gera a árvore completa, dimensões corretas, ICO legível e preserva originais', async (t) => {
  const { directory } = await fixture(t);
  const originals = new Map<string, Buffer>();
  for (const role of ['banner_dark', 'banner_light', 'logo_hor_dark', 'logo_hor_light', 'logo_icon', 'logo_square', 'logo_text', 'logo_square_black']) {
    const wide = /banner|hor|text/.test(role);
    const png = /banner|square/.test(role);
    const data = Buffer.from(svg(wide ? 128 : 32, 32));
    const filename = `marca_${role}.${png ? 'png' : 'svg'}`;
    const bytes = png ? await sharp(data).png().toBuffer() : data;
    originals.set(filename, bytes);
    await writeFile(path.join(directory, filename), bytes);
  }
  const result = await convertProject(directory);
  assert.equal(result.files.length, 25);
  assert.deepEqual(result.warnings, []);
  for (const [filename, bytes] of originals) {
    assert.deepEqual(await readFile(path.join(directory, filename)), bytes);
    const stem = path.parse(filename).name;
    await dimensions(path.join(directory, '1024', `${stem}_1024.png`), 1024, /banner|hor|text/.test(stem) ? 256 : 1024, 'png');
  }
  for (const [filename, size] of [
    ['android-chrome-192x192.png', 192], ['android-chrome-512x512.png', 512],
    ['apple-touch-icon-precomposed.png', 180], ['apple-touch-icon.png', 180],
    ['favicon-16x16.png', 16], ['favicon-32x32.png', 32], ['favicon-96x96.png', 96],
    ...[48, 72, 96, 128, 192, 384, 512].map((size): [string, number] => [`icons/icon-${size}x${size}.png`, size]),
  ] satisfies [string, number][]) await dimensions(path.join(directory, 'web', filename), size, size, 'png');
  for (const theme of ['dark', 'light']) await dimensions(path.join(directory, 'web', `og-image-${theme}.webp`), 1200, 630, 'webp');
  const ico = await readFile(path.join(directory, 'web', 'favicon.ico'));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  let expectedOffset = 54;
  for (const [index, size] of [16, 32, 48].entries()) {
    const entry = 6 + index * 16;
    assert.equal(ico[entry], size);
    assert.equal(ico[entry + 1], size);
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.equal(offset, expectedOffset);
    await dimensions(ico.subarray(offset, offset + length), size, size, 'png');
    expectedOffset += length;
  }
  assert.equal(expectedOffset, ico.length);
  assert.deepEqual((await convertProject(directory)).files, result.files);
  assert.equal((await readdir(path.join(directory, '1024'))).length, 8);
});

test('ícones retangulares recebem transparência sem corte e OG recebe fundo por tema', async (t) => {
  const { directory } = await fixture(t);
  await writeFile(path.join(directory, 'logo_icon.svg'), svg(16, 8));
  const result = await convertProject(directory, { only: 'web' });
  assert.equal(result.files.length, 17);
  assert.equal(result.warnings.length, 2);
  await assert.rejects(readdir(path.join(directory, '1024')), { code: 'ENOENT' });
  const { data, info } = await sharp(path.join(directory, 'web', 'android-chrome-512x512.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0);
  const middle = (256 * info.width + 256) * 4;
  assert.deepEqual([...data.subarray(middle, middle + 4)], [255, 0, 0, 255]);
  for (const [theme, color] of [['dark', [17, 24, 39]], ['light', [255, 255, 255]]] as const) {
    const og = await sharp(path.join(directory, 'web', `og-image-${theme}.webp`)).raw().toBuffer();
    color.forEach((value, channel) => assert.ok(Math.abs(og[channel] - value) <= 5));
  }
});

test('nomes livres, extensão maiúscula e preferência por SVG em duplicatas', async (t) => {
  const { directory } = await fixture(t);
  await writeFile(path.join(directory, 'Arte.SVG'), svg(10, 20));
  await writeFile(path.join(directory, 'Arte.png'), await sharp(Buffer.from(svg())).png().toBuffer());
  await writeFile(path.join(directory, 'ignorar.txt'), 'sem imagem');
  const result = await convertProject(directory, { only: '1024' });
  assert.deepEqual(result.files, ['1024/Arte_1024.png']);
  assert.match(result.warnings[0], /duplicado/);
  await dimensions(path.join(directory, result.files[0]), 512, 1024, 'png');
  await assert.rejects(readdir(path.join(directory, 'web')), { code: 'ENOENT' });
});

test('projetos vazios e papéis ausentes produzem avisos claros', async (t) => {
  const { directory } = await fixture(t);
  assert.match((await convertProject(directory)).warnings[0], /Nenhum arquivo/);
  await writeFile(path.join(directory, 'livre.svg'), svg());
  const result = await convertProject(directory);
  assert.equal(result.files.length, 1);
  assert.equal(result.warnings.length, 3);
});

test('CLI seleciona projetos, valida opções e continua após um projeto corrompido', async (t) => {
  const { root, directory } = await fixture(t, 'a-quebrado');
  await writeFile(path.join(directory, 'logo_icon.png'), 'invalid png');
  await mkdir(path.join(root, 'b-valido'));
  await writeFile(path.join(root, 'b-valido', 'logo_icon.svg'), svg());
  const runtimeArgs = process.versions.bun ? [] : ['--import', 'tsx'];
  const run = (...args: string[]) => spawnSync(process.execPath, [...runtimeArgs, cli, ...args], { encoding: 'utf8' });
  assert.equal(run('--help').status, 0);
  assert.match(run('--version').stdout, /^0\.1\.0/);
  assert.equal(run('convert', '..', '--root', root).status, 1);
  assert.equal(run('convert', '--only', 'invalido').status, 1);
  assert.equal(run('convert', '--desconhecido').status, 1);
  assert.equal(run('convert', '--root', path.join(root, 'ausente')).status, 1);
  const all = run('convert', '--root', root);
  assert.equal(all.status, 1);
  assert.match(all.stderr, /a-quebrado.*Erro/);
  assert.match(all.stdout, /b-valido.*18 arquivo/);
  const selected = run('convert', 'b-valido', '--root', root, '--only', '1024');
  assert.equal(selected.status, 0);
  assert.match(selected.stdout, /1 arquivo/);
});

test('não segue links simbólicos para entradas nem para pastas de saída', async (t) => {
  const { root, directory } = await fixture(t);
  const external = path.join(root, 'externo');
  await mkdir(external);
  await writeFile(path.join(external, 'logo.svg'), svg());
  await symlink(path.join(external, 'logo.svg'), path.join(directory, 'logo_icon.svg'));
  assert.equal((await convertProject(directory)).files.length, 0);
  await writeFile(path.join(directory, 'real.svg'), svg());
  await symlink(external, path.join(directory, '1024'));
  await assert.rejects(convertProject(directory), /pasta real/);
  assert.deepEqual(await readdir(external), ['logo.svg']);
});
