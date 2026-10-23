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
- **WebView2 的 GPU 进程起不来时，浏览器会整个自杀。** 在一部分机器上，切到五线谱
  窗口瞬间只剩底色——整个应用崩溃。库视图好好的，只是因为库不触发 GPU 初始化；
  谱面画布是第一个真要 GPU 的东西。崩溃转储（`%LOCALAPPDATA%\com.songscription.catalogue\
  EBWebView\Crashpad\reports\`，用 `workspace/parse-dmp.py` 解析）里四个全是同一条：
  `FATAL:gpu_data_manager_impl_private.cc:408] GPU process isn't usable. Goodbye.`——
  GPU 进程反复启动失败后，浏览器进程直接 LOG(FATAL) 自杀。跟前端用 SVG 还是 Canvas
  毫无关系（先换过一版 Canvas，白换）；跟"GPU 加速光栅化扛不住"也没关系
  （`--disable-accelerated-2d-canvas --disable-gpu-compositing` 都试过，无效）。
  修法在 `main.rs`：启动前给 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 追加
  `--disable-gpu --enable-unsafe-swiftshader --disable-gpu-sandbox`——不申请硬件加速、
  允许 WebGL 退到 SwiftShader（背景着色器改跑 CPU）、万一仍要起软件 GPU 进程时
  去掉沙箱保它能起。三层各对应一种失败原因，代价是渲染全走 CPU。

- **Tauri 自定义协议下运行时 `import()` 分块会整页带崩。** 上面那条 GPU 修法让
  `五线谱` 视图能走到加载，却立刻报 `Uncaught TypeError: Failed to fetch
  dynamically imported module: http://tauri.localhost/assets/Staff-*.js`——因为
  `SongSheet.tsx` 用 `React.lazy(() => import("./Staff"))` 懒加载，而 Tauri 的
  `asset:` 协议在运行时拉分块会失败（入口 `index-*.js` 正常，只有 `import()` 的
  分块挂）。这下屏幕只剩底色，看着和 GPU 崩溃一模一样，其实是另一层坑。
  `Settings.tsx` 里导出用的 `import("@/lib/staff-render")` 等四个也同病。
  修法：两处都改静态引入（见 `SongSheet.tsx` 顶部、`Settings.tsx` 顶部），不再有
  运行时分块。桌面端从磁盘加载这点体积无所谓。**教训**：Tauri 应用别用运行时
  `import()` 拆自己的业务代码分块；`@tauri-apps/api` 那些能用的保留（它们本来就在
  能正常服务的 chunk 里）。
- **谱面高度按公式算，上下留余量。** 上加线、下加线会让音符探出谱表，曾经靠画完
  之后 `getBBox()` 实测重设 `viewBox`。SVG 崩溃（见上条）之后实测这条路没了，
  `scoreHeight()` 按行数×行高+余量计算，纸上可能多一小条空白——比崩溃便宜。
  A4 分页（`planPages`）保留了估算/复核两个钩子，如今同出一个公式，复核那道等于
  白走，留作保险丝。
- **设置页别静态 import 排版的模块。** `staff-pages` 连着 VexFlow 一兆多，一旦被设置页静态引进
  主包，开门就多背一兆。导出那条路全程动态 `import()`，让它们留在按需的 chunk 里。
- **`.board` 只有纹理没有底色。** 底色是垫在 -z-10 的 `SiteBackground` 给的。任何盖在主界面上面的
  全屏层（设置页）都得自己铺 `bg-board`，不然主界面会从字缝里透上来。
- **VexFlow 的 `resize()` 会自己乘一遍设备像素比。** 放大导出时要先把目标尺寸乘上 scale 再交给它，
  否则画布只有 1/scale，图的右边和下边会被裁掉。
