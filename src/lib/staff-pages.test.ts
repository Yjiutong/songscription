import { test } from "node:test";
import assert from "node:assert/strict";
import { keyLabel, packLines } from "./staff-pages";

/**
 * 分页是整个导出里唯一有"对错"的部分：多排一行就掉到纸外面，少排一行就白留一大块。
 * 它不碰 DOM（量高度的函数由外面注入），所以能在这里把它问清楚。
 */

/** 一页能装下多少行，全看 budget 和行高这两个数。 */
function pack(
  lines: number,
  budget: number,
  heights: number[] | number,
  measuresPerLine = 4,
): { from: number; to: number }[] {
  const heightAt = (index: number) => (Array.isArray(heights) ? heights[index] : heights);
  return packLines({
    lines,
    measuresPerLine,
    total: lines * measuresPerLine,
    budgetOf: () => budget,
    // 估算：乐观一点，与实测略有出入，好让"实测往回收"这一步真的被走到。
    estimate: (count) => count * heightAt(0),
    measure: (fromLine, toLine) => {
      let sum = 0;
      for (let i = fromLine; i < toLine; i++) sum += heightAt(i);
      return sum;
    },
  });
}

test("装得下就一直装，装满一页再翻页", () => {
  // 一页 300，一行 100：正好三行一页，最后一行单独占一页。
  const slices = pack(10, 300, 100);
  assert.deepEqual(slices, [
    { from: 0, to: 12 },
    { from: 12, to: 24 },
    { from: 24, to: 36 },
    { from: 36, to: 40 },
  ]);
});

test("实测放不下时把最后一行挪到下一页，哪怕估算说放得下", () => {
  // 第一行只有 50 高，估算照它算，一口气估出六行；实测从第二行起都是 100，
  // 于是只能退到三行。
  const slices = pack(7, 300, [50, 100, 100, 100, 100, 100, 100], 1);
  assert.deepEqual(slices, [
    { from: 0, to: 3 },
    { from: 3, to: 6 },
    { from: 6, to: 7 },
  ]);
});

test("行有高有矮，就按真实高度分页", () => {
  // 第 3 行探出了上加线，比别的高，只能和前一行挤在一页。
  const slices = pack(6, 250, [100, 100, 180, 100, 100, 100], 1);
  assert.deepEqual(slices, [
    { from: 0, to: 2 },
    { from: 2, to: 3 },
    { from: 3, to: 5 },
    { from: 5, to: 6 },
  ]);
});

test("一页至少装一行，再高也不至于死循环", () => {
  const slices = pack(3, 10, [500, 500, 500], 1);
  assert.deepEqual(slices, [
    { from: 0, to: 1 },
    { from: 1, to: 2 },
    { from: 2, to: 3 },
  ]);
});

test("最后一页的结尾停在全曲最后一小节，不会越过", () => {
  const slices = packLines({
    lines: 3,
    measuresPerLine: 4,
    total: 10,
    budgetOf: () => 1000,
    estimate: () => 1,
    measure: () => 1,
  });
  assert.deepEqual(slices, [{ from: 0, to: 10 }]);
});

test("首页页眉高一些，后面几页就能多装一行", () => {
  const slices = packLines({
    lines: 6,
    measuresPerLine: 4,
    total: 24,
    budgetOf: (pageIndex) => (pageIndex === 0 ? 200 : 300),
    estimate: (count) => count * 100,
    measure: (from, to) => (to - from) * 100,
  });
  assert.deepEqual(slices, [
    { from: 0, to: 8 }, // 首页：200，两行
    { from: 8, to: 20 }, // 之后：300，三行
    { from: 20, to: 24 },
  ]);
});

test("没有行就没有页", () => {
  assert.deepEqual(pack(0, 300, 100), []);
});

test("调名写成页眉上放得下的样子", () => {
  assert.equal(keyLabel("Bb major"), "降B大调");
  assert.equal(keyLabel("C# minor"), "升C小调");
  assert.equal(keyLabel("F major"), "F大调");
  assert.equal(keyLabel("A 小调"), "A小调");
  assert.equal(keyLabel(null), null);
});
