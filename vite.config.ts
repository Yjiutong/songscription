import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite builds the interface that the Tauri shell loads.
 *
 * There is no dev server in the shipped app: `tauri build` produces a single
 * executable and the webview loads the bundle from disk. This config only
 * exists for the two ways of looking at the code while working on it — inside
 * the Tauri window (`tauri dev`) or in a browser (`npm run dev`).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // `process.cwd()`, not `import.meta.url`: the config is bundled as CommonJS
    // or ESM depending on the package type, and this is true in both.
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
  // A .mid is data, not a module: imported from the seed folder it must resolve
  // to a URL the app can fetch at runtime.
  assetsInclude: ["**/*.mid"],
  // The Rust side has its own watcher. Vite following src-tauri would restart
  // the dev server on every cargo build artefact.
  server: { port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  clearScreen: false,
  build: {
    // WebView2 on Windows and WKWebView on macOS are current Chromium/WebKit.
    target: "chrome110",
    outDir: "dist",
    emptyOutDir: true,
  },
});
