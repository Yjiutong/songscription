// 打包出两样东西：一键安装包和便携版单文件 exe。
//
// 两遍编译共用同一个 target 目录，省掉一份依赖的重编（那是几分钟的事）。
// 顺序不能反：先出安装包——它里面嵌的是普通版 exe，数据写系统的应用数据
// 目录——再切 portable feature 覆盖 exe，最后把那份便携版拷出来。
//
// 便携版和普通版的差别只有一个：数据放在 exe 旁边还是系统目录里。功能一模
// 一样，所以两遍编的是同一份代码，靠 Cargo feature 分岔。

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const release = path.join(root, "src-tauri", "target", "release");
const out = path.join(root, "release");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const config = JSON.parse(
  fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"),
);
const version = config.version;

function run(args, extraEnv = {}) {
  console.log(`\n$ npx ${args.join(" ")}`);
  const result = spawnSync(npx, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    console.error(`\n这一步没成功（退出码 ${result.status}），停下了。`);
    process.exit(result.status ?? 1);
  }
}

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  const kb = (fs.statSync(to).size / 1024).toFixed(0);
  console.log(`  → ${path.relative(root, to)}  (${kb} kB)`);
}

// --- 1. 一键安装包（NSIS，中文界面，装给当前用户，不要管理员权限）---------
run(["tauri", "build"]);

const exe = path.join(release, "songscription.exe");
if (!fs.existsSync(exe)) {
  console.error("没有找到编译出来的 exe，bundle 可能没跑完。");
  process.exit(1);
}

// 安装包内嵌的应该是普通版：它的数据该留在系统目录，不能跟着安装位置乱跑。
if (fs.readFileSync(exe).includes("Songscription Data")) {
  console.error(
    "编译出来的 exe 里带着便携版的路径，说明上一轮的 feature 没清干净。\n" +
      "先跑一次 cargo clean -p songscription 再重来。",
  );
  process.exit(1);
}

const setup = path.join(release, "bundle", "nsis", `Songscription_${version}_x64-setup.exe`);
if (fs.existsSync(setup)) {
  console.log("\n一键安装包：");
  // 统一成连字符的写法，和便携版那只并排放着才像一对。
  copy(setup, path.join(out, `Songscription-${version}-x64-setup.exe`));
}

// --- 2. 便携版（单文件，免安装，数据放 exe 旁边）-------------------------
run(["tauri", "build", "--no-bundle", "--features", "portable"]);

if (!fs.readFileSync(exe).includes("Songscription Data")) {
  console.error(
    "便携版编译出来却找不到便携路径，feature 大概没生效。\n" +
      "检查 src-tauri/Cargo.toml 的 [features] 和 src/main.rs 的 PORTABLE 常量。",
  );
  process.exit(1);
}

console.log("\n便携版：");
copy(exe, path.join(out, `Songscription-${version}-portable-x64.exe`));

console.log("\n两样都在 release/ 里：");
console.log("  · Songscription-…-setup.exe    双击安装，装给当前用户");
console.log("  · Songscription-…-portable-x64.exe  放哪儿都能跑，曲谱存在它旁边的 Songscription Data 里");
