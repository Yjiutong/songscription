# 开发者笔记

给改这份代码的人看的。想装来用的人读 `README.md` 就够了，这里不必看。

## 这个版本从哪里来

- 它起初是一个 web 应用——服务器上的 Next.js，Supabase 存数据库和文件。现在它是一个桌面应用；
  `db/schema.sql` 保留下来，作为数据模型的可读记录。
- 共用密码那道门跟着服务器一起走了。给一个单人用的桌面应用加密码守不住什么：坐在键盘前的人
  本来就已经有那些文件了。

## 界面

- 界面文案与代码注释都是中文；标识符、类型名、SQL 保持英文。
- 设计规范在 `DESIGN.md`：中国古典的朱漆鎏金——朱漆作底（`#6E1B1A`），鎏金作纹（`#D9B24C`），
  纸页是宣纸（`#FBF6E9`），字是松烟墨（`#241A12`）。令牌名描述的是角色而不是颜色，换配色只换取值，
  不改名。
- `screenshots/` 里的图来自最初的 web 版。界面写法没变，但截图上的浏览器外壳已经不属于这个应用。

## 踩过的坑

- **`cargo build --release` 出来的 exe 是白屏的。** Tauri v2 已经没有 `custom-protocol` feature，
  前端资源只有在 `npm run desktop:build`（即 `tauri build`）时才会嵌进二进制。想快一点可以用
  `npx tauri build --no-bundle`。
- **部分虚拟机/沙箱里桌面端会白屏。** 原因是 WebView2 的 GPU 进程反复崩溃
  （`GPU process isn't usable`），加 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-gpu-sandbox`
  可绕过；`--disable-gpu` 和 `--use-angle=swiftshader` 都不管用。崩溃现场在
  `%LOCALAPPDATA%\com.songscription.catalogue\EBWebView\Crashpad\reports\`。
- **谱面高度不能按常数估。** 上加线、下加线会让音符探出谱表，所以 `staff-render.ts` 画完之后用
  `getBBox()` 重设 `viewBox`；A4 分页也先实测再决定一行一行往回收（`planPages`）。
- **VexFlow 的 `resize()` 会自己乘一遍设备像素比。** 放大导出时要先把目标尺寸乘上 scale 再交给它，
  否则画布只有 1/scale，图的右边和下边会被裁掉。
