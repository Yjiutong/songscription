import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfFromJpegs } from "./pdf";

/**
 * PDF 也是自己拼的。最要紧的一件事是偏移表（xref）不能错：错一个字节，阅读器就
 * 说文件坏了。所以这里的测试基本都在干一件事——按写下去的偏移找回去，看那儿是不是
 * 真的写着该有的东西。
 */

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function text(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

test("开头是 PDF 头，结尾是 %%EOF", async () => {
  const bytes = await bytesOf(pdfFromJpegs([{ jpeg: JPEG, width: 40, height: 60 }]));
  assert.ok(text(bytes).startsWith("%PDF-1.4"));
  assert.ok(text(bytes).trimEnd().endsWith("%%EOF"));
});

test("startxref 指向的位置确实是 xref 表", async () => {
  const body = text(await bytesOf(pdfFromJpegs([{ jpeg: JPEG, width: 40, height: 60 }])));
  const at = Number(/startxref\n(\d+)\n%%EOF/.exec(body)?.[1]);
  assert.equal(body.slice(at, at + 4), "xref");
});

test("xref 里的每个偏移都指向对应的对象", async () => {
  const body = text(await bytesOf(pdfFromJpegs([{ jpeg: JPEG, width: 40, height: 60 }])));
  const xrefAt = Number(/startxref\n(\d+)\n%%EOF/.exec(body)?.[1]);
  const header = /xref\n0 (\d+)\n/.exec(body.slice(xrefAt));
  const size = Number(header?.[1]);
  assert.equal(size, 6); // 空闲 + Catalog + Pages + 一页的三个对象

  const entries = body
    .slice(xrefAt)
    .split("\n")
    .filter((line) => /^\d{10} \d{5} n $/.test(line))
    .map((line) => Number(line.slice(0, 10)));
  assert.equal(entries.length, 5);
  entries.forEach((offset, index) => {
    assert.ok(body.slice(offset).startsWith(`${index + 1} 0 obj\n`));
  });
});

test("trailer 的 Size 与 xref 表头一致，Root 指向 Catalog", async () => {
  const body = text(await bytesOf(pdfFromJpegs([{ jpeg: JPEG, width: 40, height: 60 }])));
  const size = Number(/xref\n0 (\d+)\n/.exec(body)?.[1]);
  assert.match(body, new RegExp(`/Size ${size} /Root 1 0 R`));
  assert.match(body, /1 0 obj\n<< \/Type \/Catalog \/Pages 2 0 R >>/);
});

test("一页就有一个 Page，三页就有三个，页面尺寸是 A4", async () => {
  const one = text(await bytesOf(pdfFromJpegs([{ jpeg: JPEG, width: 40, height: 60 }])));
  assert.match(one, /\/Type \/Pages \/Kids \[3 0 R\] \/Count 1/);

  const three = text(
    await bytesOf(
      pdfFromJpegs([
        { jpeg: JPEG, width: 40, height: 60 },
        { jpeg: JPEG, width: 40, height: 60 },
        { jpeg: JPEG, width: 40, height: 60 },
      ]),
    ),
  );
  assert.match(three, /\/Kids \[3 0 R 6 0 R 9 0 R\] \/Count 3/);
  // A4：210 × 297 毫米换成点是 595.28 × 841.89。
  assert.match(one, /\/MediaBox \[0 0 595.28 841.89\]/);
});

test("图用 DCTDecode 原样嵌进去，长度与字节数一致", async () => {
  const bytes = await bytesOf(pdfFromJpegs([{ jpeg: JPEG, width: 40, height: 60 }]));
  const body = text(bytes);
  assert.match(body, /\/Filter \/DCTDecode \/Length 12/);
  assert.match(body, /\/ColorSpace \/DeviceRGB \/BitsPerComponent 8/);
  const at = body.indexOf("stream\n") + "stream\n".length;
  assert.deepEqual(bytes.subarray(at, at + JPEG.length), JPEG);
});

test("没有页就报错，不写一个空文件出来", () => {
  assert.throws(() => pdfFromJpegs([]), /没有可以写进 PDF 的页/);
});
