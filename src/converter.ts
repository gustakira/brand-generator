import { lstat, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { ResizeOptions } from 'sharp';
import { encodeIco } from './ico.js';

export type OutputType = 'all' | '1024' | 'web';

export interface ConvertOptions {
  only?: OutputType;
}

export interface ConvertResult {
  name: string;
  files: string[];
  warnings: string[];
}

interface Source {
  file: string;
  stem: string;
  extension: string;
}

interface ImageOptions {
  fit?: ResizeOptions['fit'];
  background?: ResizeOptions['background'];
  webp?: boolean;
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const THEMES = { dark: '#111827', light: '#ffffff' };
const ICONS = [48, 72, 96, 128, 192, 384, 512];
const SQUARE_PNGS: [string, number][] = [
  ['android-chrome-192x192.png', 192],
  ['android-chrome-512x512.png', 512],
  ['apple-touch-icon-precomposed.png', 180],
  ['apple-touch-icon.png', 180],
  ...ICONS.map((size): [string, number] => [`icons/icon-${size}x${size}.png`, size]),
];

async function exists(file: string) {
  try { return await lstat(file); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error; }
}

async function outputDirectory(directory: string) {
  const info = await exists(directory);
  if (info && (!info.isDirectory() || info.isSymbolicLink())) {
    throw new Error(`A saída deve ser uma pasta real: ${directory}`);
  }
  await mkdir(directory, { recursive: true });
}

// A troca por rename evita deixar um arquivo incompleto no lugar de uma saída válida.
async function save(file: string, data: Buffer) {
  const temporary = path.join(path.dirname(file), `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, data, { flag: 'wx' });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function sourcesIn(directory: string, warnings: string[]) {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.(png|svg)$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const sources = new Map<string, Source>();
  for (const entry of entries) {
    const extension = path.extname(entry.name).toLowerCase();
    const stem = entry.name.slice(0, -extension.length);
    const key = stem.toLowerCase();
    const source = { file: path.join(directory, entry.name), stem, extension };
    const previous = sources.get(key);
    if (previous) {
      const winner = extension === '.svg' && previous.extension !== '.svg' ? source : previous;
      sources.set(key, winner);
      warnings.push(`Nome duplicado "${stem}": usando ${path.basename(winner.file)}.`);
    } else {
      sources.set(key, source);
    }
  }
  return sources;
}

// Renderiza vetores na resolução de destino antes do resize, inclusive SVGs de 16px.
async function input(source: Source, width: number, height: number) {
  let density = 72;
  if (source.extension === '.svg') {
    const metadata = await sharp(source.file).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`SVG sem dimensões: ${source.file}`);
    density = Math.min(100000, Math.max(1, 72 * Math.min(width / metadata.width, height / metadata.height)));
  }
  return sharp(source.file, { density }).rotate();
}

async function resize(source: Source, width: number, height: number, { fit = 'contain', background = TRANSPARENT, webp = false }: ImageOptions = {}) {
  let pipeline = (await input(source, width, height)).resize(width, height, { fit, background });
  if (webp) pipeline = pipeline.flatten({ background }).webp({ quality: 90 });
  else pipeline = pipeline.png();
  return pipeline.toBuffer();
}

function squarePngs(source: Source, { rounded = false } = {}) {
  const cache = new Map<number, Buffer>();
  return async (size: number): Promise<Buffer> => {
    const cached = cache.get(size);
    if (cached) return cached;
    let data = await resize(source, size, size);
    if (rounded) {
      const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.25}" fill="white"/></svg>`);
      data = await sharp(data).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    }
    cache.set(size, data);
    return data;
  };
}

/** Converte os arquivos de uma pasta de projeto; não modifica os originais. */
export async function convertProject(directory: string, { only = 'all' }: ConvertOptions = {}): Promise<ConvertResult> {
  if (!['all', '1024', 'web'].includes(only)) throw new Error('Use only: all, 1024 ou web.');
  directory = path.resolve(directory);
  const info = await exists(directory);
  if (!info?.isDirectory() || info.isSymbolicLink()) throw new Error(`Projeto não encontrado ou pasta inválida: ${directory}`);
  const name = path.basename(directory);
  const warnings: string[] = [];
  const files: string[] = [];
  const sources = await sourcesIn(directory, warnings);
  if (!sources.size) {
    return { name, files, warnings: [...warnings, 'Nenhum arquivo PNG ou SVG na raiz do projeto.'] };
  }
  const role = (suffix: string) => sources.get(`${name}_${suffix}`.toLowerCase()) ?? sources.get(suffix);
  const emit = async (relative: string, data: Buffer) => {
    await save(path.join(directory, relative), data);
    files.push(relative);
  };
  const emitFavicons = async (relative: string, pngAt: (size: number) => Promise<Buffer>) => {
    await outputDirectory(path.join(directory, relative));
    for (const size of [16, 32, 96]) await emit(`${relative}/favicon-${size}x${size}.png`, await pngAt(size));
    const frames = [];
    for (const size of [16, 32, 48]) frames.push({ size, data: await pngAt(size) });
    await emit(`${relative}/favicon.ico`, encodeIco(frames));
  };

  if (only !== 'web') {
    await outputDirectory(path.join(directory, '1024'));
    for (const source of sources.values()) {
      await emit(`1024/${source.stem}_1024.png`, await resize(source, 1024, 1024, { fit: 'inside' }));
    }
  }

  if (only !== '1024') {
    await outputDirectory(path.join(directory, 'web'));
    const icon = role('logo_icon');
    const square = role('logo_square');
    if (icon) {
      await emitFavicons('web', squarePngs(icon));
    } else {
      warnings.push('Favicons não gerados: adicione logo_icon (PNG/SVG).');
    }
    if (square) {
      await outputDirectory(path.join(directory, 'web', 'icons'));
      const squareAt = squarePngs(square);
      for (const [file, size] of SQUARE_PNGS) await emit(`web/${file}`, await squareAt(size));
      await emitFavicons('web/favicon-rounded', squarePngs(square, { rounded: true }));
    } else {
      warnings.push('Ícones Android, Apple, web/icons e web/favicon-rounded não gerados: adicione logo_square (PNG/SVG).');
    }
    for (const [theme, background] of Object.entries(THEMES)) {
      const source = role(`banner_${theme}`) ?? role(`logo_hor_${theme}`) ?? square ?? role('logo_square_black');
      if (!source) {
        warnings.push(`og-image-${theme}.webp não gerada: adicione banner_${theme}, logo_hor_${theme}, logo_square ou logo_square_black.`);
        continue;
      }
      if (!role(`banner_${theme}`)) warnings.push(`og-image-${theme}.webp: usando ${path.basename(source.file)} como alternativa ao banner.`);
      await emit(`web/og-image-${theme}.webp`, await resize(source, 1200, 630, { background, webp: true }));
    }
  }
  return { name, files, warnings };
}

/** Lista somente subpastas reais, sem seguir links simbólicos. */
export async function listProjects(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name).sort();
}
