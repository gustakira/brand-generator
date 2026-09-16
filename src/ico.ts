export interface IcoImage {
  size: number;
  data: Buffer;
}

// ICO aceita imagens PNG embutidas, uma por resolução.
export function encodeIco(images: readonly IcoImage[]): Buffer {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  for (const [index, { size, data }] of images.entries()) {
    if (!Number.isInteger(size) || size < 1 || size > 256) {
      throw new Error('A resolução de um frame ICO deve estar entre 1 e 256.');
    }
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  }
  return Buffer.concat([header, ...images.map(({ data }) => data)]);
}
