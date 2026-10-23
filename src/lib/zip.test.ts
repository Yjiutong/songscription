import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, zipStore } from "./zip";

/**
 * ZIP 是自己写的，那就要自己证明它写对了——不然用户在解压软件里看到"文件已损坏"
 * 时，谁也不知道问题出在哪一层。这里只能验结构；真正能不能解开，交给解压软件。
 */

test("crc32 与公认的校验值一致", async () => {
  const bytes = new TextEncoder().encode("The quick brown fox jumps over the lazy dog");
  assert.equal(crc32(bytes), 0x414fa339);
  assert.equal(crc32(new Uint8Array([])), 0);
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("zip 以本地文件头开头，以结尾记录收尾", async () => {
  const bytes = await bytesOf(zipStore([{ name: "第一页.png", data: new Uint8Array([1, 2, 3]) }]));
  assert.equal(readU32(bytes, 0), 0x04034b50);
  assert.equal(readU32(bytes, bytes.length - 22), 0x06054b50);
});

test("文件大小与条目数写进了结尾记录", async () => {
  const entries = [
    { name: "a.png", data: new Uint8Array([1, 2, 3]) },
    { name: "b.png", data: new Uint8Array([9, 9]) },
  ];
  const bytes = await bytesOf(zipStore(entries));
  const eocd = bytes.length - 22;
  assert.equal(readU16(bytes, eocd + 10), entries.length); // 本磁盘条目数
  assert.equal(readU16(bytes, eocd + 8), entries.length); // 总条目数
});

test("中央目录的偏移真的指向中央目录", async () => {
  const bytes = await bytesOf(zipStore([{ name: "第一页.png", data: new Uint8Array([1, 2, 3]) }]));
  const eocd = bytes.length - 22;
  const centralAt = readU32(bytes, eocd + 16);
  assert.equal(readU32(bytes, centralAt), 0x02014b50);
});

test("本地文件头里的偏移与中央目录记的一致", async () => {
  const bytes = await bytesOf(zipStore([{ name: "x.png", data: new Uint8Array([7]) }]));
  const centralAt = readU32(bytes, bytes.length - 22 + 16);
  const localAt = readU32(bytes, centralAt + 42);
  assert.equal(readU32(bytes, localAt), 0x04034b50);
});

test("中文文件名按 UTF-8 存，并置上了第 11 位标志位", async () => {
  const bytes = await bytesOf(zipStore([{ name: "第 1 页.png", data: new Uint8Array([1]) }]));
  const flags = readU16(bytes, 6);
  assert.equal(flags & 0x0800, 0x0800);
  const nameLength = readU16(bytes, 26);
  const name = new TextDecoder().decode(bytes.subarray(30, 30 + nameLength));
  assert.equal(name, "第 1 页.png");
});

test("存档：压缩前后的大小与 CRC 都对得上", async () => {
  const data = new Uint8Array([5, 6, 7, 8]);
  const bytes = await bytesOf(zipStore([{ name: "d.bin", data }]));
  assert.equal(readU32(bytes, 18), data.length); // 压缩后
  assert.equal(readU32(bytes, 22), data.length); // 压缩前
  assert.equal(readU32(bytes, 14), crc32(data));
});

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function readU16(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8);
}

function readU32(bytes: Uint8Array, at: number): number {
  return (
    bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24) >>> 0
  );
}
