/**
 * 极简 ZIP（仅存档，不压缩）。
 *
 * 一册谱子排出来是十几张 PNG，逐个下载会把浏览器的下载栏塞满，用户还得自己一张张
 * 改名归档。打成 zip 只要两百行不到的代码，而 PNG 本身已经压过了，存档等于不存档；
 * JPG 同理。为这点事引入一个压缩库不值得。
 *
 * 格式细节见 PKWARE APPNOTE 4.4.4 起。这里只写必要的：本地文件头、中央目录、结尾记录。
 */

/** CRC-32 表，建一次到处用。 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export type ZipEntry = { name: string; data: Uint8Array };

/** MS-DOS 的日期时间：日期挤在 16 位里、秒只有 5 位（所以要除以 2）。 */
function dosDateTime(when: Date): { time: number; date: number } {
  const time =
    ((when.getHours() & 0x1f) << 11) | ((when.getMinutes() & 0x3f) << 5) | (Math.floor(when.getSeconds() / 2) & 0x1f);
  const date = (((when.getFullYear() - 1980) & 0x7f) << 9) | (((when.getMonth() + 1) & 0x0f) << 5) | (when.getDate() & 0x1f);
  return { time, date };
}

/** 边写边记长度，好算中央目录的偏移。 */
class Bytes {
  private chunks: Uint8Array[] = [];
  length = 0;

  push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  ascii(text: string): void {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
    this.push(out);
  }

  u16(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]));
  }

  concat(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}

/** 文件名一律按 UTF-8 存，并置上第 11 位标志位，免得在别处解出来是乱码。 */
function utf8(name: string): Uint8Array {
  return new TextEncoder().encode(name);
}

export function zipStore(entries: ZipEntry[], when = new Date()): Blob {
  const { time, date } = dosDateTime(when);
  const out = new Bytes();
  const central: { name: Uint8Array; offset: number; crc: number; size: number }[] = [];

  for (const entry of entries) {
    const name = utf8(entry.name);
    const crc = crc32(entry.data);
    const offset = out.length;

    // 本地文件头
    out.u32(0x04034b50);
    out.u16(20); // 需要的版本
    out.u16(0x0800); // 标志位 11：文件名是 UTF-8
    out.u16(0); // 存档，不压缩
    out.u16(time);
    out.u16(date);
    out.u32(crc);
    out.u32(entry.data.length);
    out.u32(entry.data.length);
    out.u16(name.length);
    out.u16(0);
    out.push(name);
    out.push(entry.data);

    central.push({ name, offset, crc, size: entry.data.length });
  }

  const centralAt = out.length;
  for (const item of central) {
    out.u32(0x02014b50);
    out.u16(20); // 产生方版本
    out.u16(20); // 需要的版本
    out.u16(0x0800);
    out.u16(0);
    out.u16(time);
    out.u16(date);
    out.u32(item.crc);
    out.u32(item.size);
    out.u32(item.size);
    out.u16(item.name.length);
    out.u16(0); // 扩展字段
    out.u16(0); // 注释
    out.u16(0); // 起始磁盘号
    out.u16(0); // 内部属性
    out.u32(0); // 外部属性
    out.u32(item.offset);
    out.push(item.name);
  }
  const centralSize = out.length - centralAt;

  out.u32(0x06054b50);
  out.u16(0);
  out.u16(0);
  out.u16(central.length);
  out.u16(central.length);
  out.u32(centralSize);
  out.u32(centralAt);
  out.u16(0);

  return new Blob([out.concat()], { type: "application/zip" });
}
