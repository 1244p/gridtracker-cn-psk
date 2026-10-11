// Drives a running dev copy over the Chrome DevTools Protocol (launch it with --remote-debugging-port, see relaunch.ps1)
//   node tools/cdp.mjs list                              pages and workers
//   node tools/cdp.mjs <page> eval "<expr>"              evaluate in a page, prints the JSON result
//   node tools/cdp.mjs <page> evalfile <file.js>         same, with the expression read from a file
//   node tools/cdp.mjs <page> shot <out.png>             screenshot
// <page> is the html file name, e.g. GridTracker2.html or gt_roster.html. Port: CDP_PORT (default 9333).
// Promises are awaited, so an async IIFE works for multi-step checks.
const port = process.env.CDP_PORT || 9333;
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const [pageName, cmd, arg] = process.argv.slice(2);
if (pageName === "list")
{
  console.log(list.map((p) => p.type + " " + p.url).join("\n"));
  process.exit(0);
}
const page = list.find((p) => p.type === "page" && p.url.endsWith("/" + pageName));
if (!page)
{
  console.log("page not found: " + pageName);
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = {};
ws.onmessage = (m) =>
{
  const d = JSON.parse(m.data);
  pending[d.id]?.(d);
};
const call = (method, params = {}) => new Promise((r) =>
{
  pending[++id] = r;
  ws.send(JSON.stringify({ id, method, params }));
});
await new Promise((r) => (ws.onopen = r));
if (cmd === "eval" || cmd === "evalfile")
{
  const expression = cmd === "evalfile" ? (await import("fs")).readFileSync(arg, "utf8") : arg;
  const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  const ex = r.result.exceptionDetails;
  console.log(JSON.stringify(ex ? ex.exception?.description ?? ex : r.result.result?.value ?? r.result.result));
}
else if (cmd === "shot")
{
  const r = await call("Page.captureScreenshot", { format: "png" });
  (await import("fs")).writeFileSync(arg, Buffer.from(r.result.data, "base64"));
  console.log("saved " + arg);
}
else
{
  console.log("unknown command: " + cmd);
}
ws.close();
