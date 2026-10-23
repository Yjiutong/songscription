# Songscription

*English version: [README.en.md](./README.en.md)*

一份「已经扒下来的谱子」的目录册。

你丢给它一个 `.mid`，它读完文件，用新手听得懂的话告诉你：这首有多长、有多难、用的是哪几个调、
两只手各忙成什么样、从哪儿下手。它还会用自己在窗口里合成的钢琴把曲子弹出来——没有一个音频
文件——书签、笔记、练习记录，全都存在你自己机器上的数据库里。

**它是一个桌面应用。** 一个窗口，没有服务器，没有浏览器标签页，没有账号，没有什么要配置的。

---

## 它由什么组成

两层，而这一刀切在哪里才是重点。

```
  src/                        应用本体
  ├── lib/midi.ts             分析：量这份文件，给难度打分
  ├── lib/audio.ts            合成：加法钢琴，滚动排程
  ├── lib/db.ts               这本目录跑的每一句 SQL
  ├── lib/notation.ts         量化：把 MIDI 音符排成小节
  ├── lib/staff-render.ts     谱面：用 VexFlow 画到 SVG / Canvas
  ├── lib/staff-pages.ts      A4 分页：量高度、分页、合成一页、导出成册
  ├── lib/zip.ts pdf.ts       零依赖打包：ZIP 与 PDF
  ├── lib/platform/           ── 接缝 ──────────────────────────
  │   ├── types.ts             应用需要的东西：SQL 加文件
  │   ├── desktop.ts           invoke() → Rust
  │   └── web.ts               sql.js + IndexedDB（仅供开发）
  ├── components/             界面，用 React 与 SVG 画的
  │   ├── Roll.tsx              琴卷图
  │   └── Staff.tsx             五线谱
  └── App.tsx                 打开数据库、播种、渲染

  src-tauri/                  外壳
  ├── src/db.rs               SQLite 桥（rusqlite）
  ├── src/storage.rs          磁盘上的 .mid 文件
  └── src/main.rs             窗口，九个命令
```

有意思的代码在 TypeScript 这边。Rust 手上只有一个数据库句柄、几个文件操作和一个窗口。它不知道
什么叫"一首曲子"，不掌握 schema，也从不看见难度分——所以难的那部分只有一份实现，只用一种语言。

`src/lib/platform/types.ts` 是那道接缝。接缝以上，应用分不清自己是跑在 SQLite 上的 webview 里，
还是跑在浏览器标签页里的 WebAssembly 上。两个适配器执行的是 `src/lib/db.ts` 里**同一批** SQL，
所以一条查询不可能在两边悄悄算出不一样的结果。

### 东西存在哪里

| | 桌面端（`npm run desktop`） | 浏览器（`npm run dev`） |
|---|---|---|
| 数据库 | SQLite 文件，`rusqlite` | SQLite 文件，`sql.js`（WASM） |
| 数据行住在 | 应用数据目录 | 浏览器 profile 里的 IndexedDB |
| `.mid` 文件 | 一个你能自己打开的文件夹 | IndexedDB 里的 blob |
| 重装后还在吗 | 在，只要留着那个文件夹 | 不在 |

桌面版把所有东西放在一个文件夹里，所以备份就是复制一次：

- **Windows** `%APPDATA%\com.songscription.catalogue\data\`
- **macOS** `~/Library/Application Support/com.songscription.catalogue/data/`
- **Linux** `~/.local/share/com.songscription.catalogue/data/`

里面是 `catalogue.db` 和 `midi/`。复制这个文件夹就是备份，放回去就是还原。

浏览器版的存在，是为了让界面能不开 Rust 工具链就打开、能改。它不是产品：数据躺在浏览器 profile
里，容易丢，所以我们不按那个样子发布。

---

## 跑起来

### 要准备什么

- **Node 20+**
- **Rust**（`rustup`）加平台对应的 C 工具链——Windows 上是 Visual Studio Build Tools 里 *Desktop
  development with C++* 那一套。`rusqlite` 用的是 `bundled`，SQLite 会编进去，别的什么都不用装。
- **WebView2** —— Windows 11 和较新的 Windows 10 自带；macOS 和 Linux 用系统自带的 webview。

### 命令

```bash
npm install

npm run desktop        # 真窗口里的应用，带热重载
npm run package        # 一次编出两样：一键安装包与便携版单文件 exe

npm run dev            # 浏览器里的界面，不需要 Rust（仅开发用）
npm test               # 74 个单元测试，其中 SQL 也对着真的 SQLite 跑
```

没有环境变量，没有密钥，没有要先启动的服务。

### 两个 exe，各管一种场合

`npm run package` 会编两遍，把两个 exe 放进 `release/`：

| 文件 | 怎么用 | 曲谱存在哪 |
|---|---|---|
| `Songscription-0.1.0-x64-setup.exe` | 双击安装。中文向导，装给当前用户，不要管理员权限 | 系统的应用数据目录 |
| `Songscription-0.1.0-portable-x64.exe` | 免安装，放在哪就从哪跑 | 它旁边的 `Songscription Data\` 文件夹 |

便携版把整套东西收进一个文件里：拷到 U 盘、拷到另一台装了 WebView2 的 Windows，曲谱跟着一起走。
要是它待在一个写不进去的地方——Program Files、写保护的 U 盘——会自己退回系统目录，不会因为存不下
就启动不了。想把它挪走，连 `Songscription Data` 一起挪，那是它的全部家当。

两者的功能一模一样，差别只有数据放在哪儿。安装版的好处是进开始菜单、能卸载；便携版的好处是不留
痕迹，删掉文件夹就干净了。

### 如果 Rust 编不了

`npm run dev` 会在浏览器里跑同一个界面，背后是 `sql.js`。不用工具链，不联网。它给不了你的是：一个
能双击打开的应用，和一个你能备份的文件夹。

---

## 它做的事

- **量出来的，从来不是猜的。** 时长、速度、拍号、调号、音符数、音域、复音程度、黑键占比、左右手
  各自的密度，全部出自文件本身。首次启动会用和上传完全一样的方式量一遍内置的九首，所以架子上不
  可能出现一条真实流程永远产生不出来的记录。
- **难度是一笔有收据的分。** 五个带权重的因子，其中最要紧的是*较忙的那只手*相对*较闲的那只*有多
  快：难住人的是两只手同时开工，不是最大的那个和弦。分数是分进 1–5 档，而不是取平均——取平均会把
  十二首里的七首都丢进同一档，等于什么也没说。
- **播放是合成出来的。** 六个泛音加琴槌噪声和一个生成的卷积房间，每个音一套，排在一个大约 1.1 秒
  的滚动窗口里，于是五分钟的曲子不必一开始就先搭五万个节点。
- **画的就是那首曲子。** 卡片、列表行、详情页画的都是这首自己的音符：右手鎏金，左手松烟墨，落在
  一张 24px 界格的纸上。
- **谱可以从屏幕上回到纸上。** 量化好的谱面按 A4 纵向分页：四边留 14mm，首页写曲名、调号拍号速度，
  后续页留一行小曲名，页脚是页码，中间一道鎏金界行。每页能装几行以实测高度为准，只在小节之间断开。
  能导出成 PNG / JPG（每页一张，多页自动打包成 zip）或 PDF（合成一册，每页嵌一张 JPEG）。

- **窗口里的东西归你管。** 顶上一条菜单栏（编辑 / 窗口 / 帮助 / 关于），颜色跟着封面走：换一张
  深色的画它就深下去，换一张雪景它就翻成浅的，字也跟着换。设置页（Ctrl+, 或菜单里）管四件事：
  换封面、翻全部曲谱（打开、收藏、删除）、挑导出的格式和清晰度、指定输出文件夹并清理已经导出的
  文件。
- **上传只检查一次，然后就存起来。** 扩展名、是否为空、2 MB 上限；对字节做 SHA-256，既用来查重，
  也用作文件在磁盘上的名字。
- **搜索会把口音放平。** 输入 "fur elise" 能搜到 "Für Elise"，因为大家本来就是这么打的。
- **你写的那一层可以改，量出来的那一层不行。** 更新语句按白名单过滤，所以一个过时的调用方改不掉
  应用承诺过"是从文件里读出来的"那些数字。

---

## 测试

```bash
npm test
```

`src/lib/db.test.ts` 是值得记住的那一个：它把平台换成 Node 上的 SQLite，跑的是桌面版跑的**同一批**
语句。一条 insert 列了三十二个字段却按另一种顺序去绑定，看代码的时候看不出来，跑起来才炸——所以
它是被执行，而不是被阅读。

`scripts/smoke.mjs` 通过 DevTools 协议驱动一个已经在跑的构建——真实的时间、真实的 IndexedDB、真实
的音频图：

```bash
npm run build && npx vite preview --port 4173 &
"…/msedge.exe" --headless=new --remote-debugging-port=9337 --user-data-dir=/tmp/s \
  --autoplay-policy=no-user-gesture-required http://localhost:4173/ &
WAIT_MS=8000 node scripts/smoke.mjs 9337 http://localhost:4173/
```

光用 `--dump-dom` 是不够的：虚拟时间不等 IndexedDB，那样抓下来的快照永远早一步，永远只有骨架。
