// Drive the running app over the DevTools protocol, in *real* time.
//
// `--dump-dom` with `--virtual-time-budget` cannot wait for IndexedDB: virtual
// time does not know about the IDB task queue, so the budget expires while the
// open request is still pending and the snapshot is taken one step early. This
// connects to a live page, waits wall-clock seconds, then asks the page what it
// actually rendered.
const port = Number(process.argv[2] || 9333);
const url = process.argv[3] || "http://localhost:1420/";

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
// Edge opens its own profile pages; pick the tab that is actually the app.
const wanted = url.replace(/\/$/, "");
const page =
  list.find((t) => t.type === "page" && t.url.replace(/\/$/, "") === wanted) ??
  list.find((t) => t.type === "page" && t.url.includes("localhost")) ??
  list.find((t) => t.type === "page");
if (!page) {
  console.error("no page target", JSON.stringify(list.map((t) => t.url)));
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const waiting = new Map();
const consoleLines = [];

ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.consoleAPICalled") {
    const text = message.params.args
      .map((a) => a.value ?? a.description ?? a.type)
      .join(" ");
    consoleLines.push(text);
  }
  if (message.method === "Runtime.exceptionThrown") {
    consoleLines.push("EXCEPTION " + JSON.stringify(message.params.exceptionDetails.text));
  }
  if (message.id && waiting.has(message.id)) {
    waiting.get(message.id)(message);
    waiting.delete(message.id);
  }
});

await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", reject);
});

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq;
    waiting.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Runtime.enable");
await new Promise((resolve) => setTimeout(resolve, Number(process.env.WAIT_MS || 9000)));

const expression = `JSON.stringify({
  url: location.href,
  title: document.title,
  articles: document.querySelectorAll("article").length,
  headings: [...document.querySelectorAll("h1,h2")].map((e) => e.textContent.trim()).slice(0, 8),
  songs: [...document.querySelectorAll("article")].map((e) => e.textContent.replace(/\\s+/g, " ").trim().slice(0, 60)).slice(0, 6),
  bodyText: document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, 300)
})`;

const result = await send("Runtime.evaluate", { expression, returnByValue: true });
console.log("=== page ===");
console.log(result.result?.result?.value ?? JSON.stringify(result));

// An optional second act: press something, wait, and look again. That is how
// playback and the write path get exercised without a person at the keyboard.
if (process.env.EVAL) {
  const acted = await send("Runtime.evaluate", {
    expression: `(async () => { ${process.env.EVAL} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log("=== acted ===", JSON.stringify(acted.result?.result?.value ?? acted.result?.exceptionDetails ?? null));
  await new Promise((resolve) => setTimeout(resolve, Number(process.env.AFTER_MS || 3000)));
  const after = await send("Runtime.evaluate", { expression, returnByValue: true });
  console.log("=== after ===");
  console.log(after.result?.result?.value ?? JSON.stringify(after));
}

console.log("=== console ===");
console.log(consoleLines.slice(-25).join("\n") || "(none)");
ws.close();
