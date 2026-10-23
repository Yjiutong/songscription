import type { Platform } from "./types";

/**
 * Which machine are we on?
 *
 * Tauri injects `__TAURI_INTERNALS__` into the window before the bundle runs,
 * so the check is a property test rather than a user agent. The adapters load
 * lazily: the desktop build never downloads sql.js, and the browser build never
 * touches the invoke bridge.
 */

let cached: Promise<Platform> | null = null;

export function getPlatform(): Promise<Platform> {
  if (!cached) cached = boot();
  return cached;
}

/**
 * Point the catalogue at something other than the machine it is running on.
 *
 * The unit tests use this to run the real SQL — the same statements the app
 * ships — against a real SQLite in Node. Nothing in the application calls it,
 * and nothing should: the point of the port is that there is one answer to
 * "where do rows live".
 */
export function setPlatform(platform: Platform): void {
  cached = Promise.resolve(platform);
}

async function boot(): Promise<Platform> {
  if ("__TAURI_INTERNALS__" in window) {
    const { createDesktopPlatform } = await import("./desktop");
    return createDesktopPlatform();
  }
  const { createBrowserPlatform } = await import("./web");
  return createBrowserPlatform();
}

export type { MidiStore, Platform, SqlEngine, SqlParam } from "./types";
