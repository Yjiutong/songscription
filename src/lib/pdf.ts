/**
 * 把一叠 JPEG 拼成一个 PDF。
 *
 * 谱子是画出来的图，不是文字流，所以最合适的做法就是每页嵌一张图。JPEG 用 PDF 的
 * DCTDecode 直接放进去即可——解码器认的就是原始 JPEG 码流，不必重新压缩，也不必
 * 引一个几百 KB 的 PDF 库。
 *
 * 只写必要的东西：Catalog、Pages、每页一个 Page / Image / Contents，外加 xref 表。
 * 坐标用点（1 点 = 1/72 英寸），A4 是 595.28 × 841.89。
 */

const POINT_PER_MM = 72 / 25.4;

export type PdfPage = {
  /** 一张 JPEG 的原始字节。 */
  jpeg: Uint8Array;
  /** 图的像素宽高，写进 Image 字典里。 */
  width: number;
  height: number;
};

/** 一段一段拼字节，同时记下每段在最终文件里的偏移——xref 要的就是这个。 */
class PdfBytes {
  private chunks: Uint8Array[] = [];
  length = 0;
  /** 每个对象（编号从 1 开始）在文件里的偏移。 */
  offsets: number[] = [];

  ascii(text: string): void {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
    this.chunks.push(out);
    this.length += out.length;
  }

  raw(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  /** 开一个对象：记下它的偏移，并写上 "n 0 obj"。 */
  object(id: number): void {
    this.offsets[id] = this.length;
    this.ascii(`${id} 0 obj\n`);
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

export function pdfFromJpegs(
  pages: PdfPage[],
  sizeMm: { width: number; height: number } = { width: 210, height: 297 },
): Blob {
  if (pages.length === 0) throw new Error("没有可以写进 PDF 的页");

  const widthPt = sizeMm.width * POINT_PER_MM;
  const heightPt = sizeMm.height * POINT_PER_MM;
  const out = new PdfBytes();

  out.ascii("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  // 1 = Catalog，2 = Pages，之后每页占 3 个号：Page / Image / Contents。
  const objectCount = 2 + pages.length * 3;
  out.object(1);
  out.ascii("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  out.object(2);
  out.ascii(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((page, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;

    out.object(pageId);
    out.ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${round(widthPt)} ${round(heightPt)}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>\nendobj\n`,
    );

    out.object(imageId);
    out.ascii(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
        `/Length ${page.jpeg.length} >>\nstream\n`,
    );
    out.raw(page.jpeg);
    out.ascii("\nendstream\nendobj\n");

    // 图像在 PDF 里是一个单位方块，用 cm 把它抻到整页。
    const content = `q ${round(widthPt)} 0 0 ${round(heightPt)} 0 0 cm /Im0 Do Q\n`;
    out.object(contentId);
    out.ascii(`<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
  });

  const xrefAt = out.length;
  out.ascii(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id++) {
    out.ascii(`${String(out.offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`);
  }
  out.ascii(
    `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`,
  );

  return new Blob([out.concat()], { type: "application/pdf" });
}

/** PDF 里的数字不带尾巴更好读，也少几个字节。 */
function round(value: number): string {
  const fixed = value.toFixed(2);
  return fixed.replace(/\.?0+$/, "");
}
