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

## 打包

- `npm run package`（`scripts/package.mjs`）编两遍，产物统一放在 `release/`：安装包和便携版单文件
  exe。两遍共用同一个 `target` 目录，省一份依赖的重编。
- **便携与否是编译期定死的**，看 `Cargo.toml` 的 `portable` feature（`src/main.rs` 的 `PORTABLE`
  常量）。不在运行时猜：把安装版的 exe 拖到桌面，文件系统和便携版长得一模一样，可数据该留在原地。
- 便携版的数据落在 exe 旁边的 `Songscription Data\`。目录写不进去时退回系统目录（真的写一个探针
  文件来判断，不看属性——ACL、只读介质、公司策略都能让"看起来可写"的目录拒绝写入）。
- 顺序不能反：先出安装包（里面嵌的是普通版 exe），再切 feature 覆盖 exe，最后把便携版拷出来。
  脚本会检查 exe 里有没有 `Songscription Data` 这个字符串，用来确认 feature 真的生效了——不然
  很容易得到一个自己以为是便携版的普通版。
- 安装包只出 NSIS，不出 MSI：NSIS 的中文向导开箱可用，WiX 的本地化要额外折腾，而体积上 NSIS 也
  小得多。安装界面语言在 `tauri.conf.json` 的 `bundle.windows.nsis.languages` 里，`SimpChinese`。
- `webviewInstallMode` 用 `embedBootstrapper`：目标机器没有 WebView2 时，安装包自己把它拉下来。
  代价是安装包大 1.8 MB。注意这只是安装版的能力——便携版 exe 假设机器上已经有 WebView2（Win11 和
  较新的 Win10 都自带）。

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
- **设置页别静态 import 排版的模块。** `staff-pages` 连着 VexFlow 一兆多，一旦被设置页静态引进
  主包，开门就多背一兆。导出那条路全程动态 `import()`，让它们留在按需的 chunk 里。
- **`.board` 只有纹理没有底色。** 底色是垫在 -z-10 的 `SiteBackground` 给的。任何盖在主界面上面的
  全屏层（设置页）都得自己铺 `bg-board`，不然主界面会从字缝里透上来。
- **VexFlow 的 `resize()` 会自己乘一遍设备像素比。** 放大导出时要先把目标尺寸乘上 scale 再交给它，
  否则画布只有 1/scale，图的右边和下边会被裁掉。
