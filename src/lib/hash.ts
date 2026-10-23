/**
 * SHA-256 of a file's bytes, lowercase hex.
 *
 * The one hash the catalogue needs: it is the duplicate check, and it is what a
 * storage name is built from. Web Crypto is available in both runtimes — the
 * desktop webview is a secure context, and so is localhost in development — so
 * there is no reason to hand this to Rust and no reason to write it twice.
 */
export async function sha256(bytes: Uint8Array): Promise<string> {
  // A copy, so the buffer handed to Web Crypto is a plain ArrayBuffer: a view
  // over a pooled or shared buffer is not a BufferSource the DOM types accept.
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
