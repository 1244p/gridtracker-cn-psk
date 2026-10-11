// Static smoke test of the repo, no app needed: node tools/smoke_static.js   (repo root)
// JS parses, JSON parses, locales match en.json, used i18n keys exist, no temporary/debug leftovers,
// no BOMs or mixed line endings, version / CHANGELOG.md / HISTORY.md shape, requireJson data files exist.
// Pre-existing COMMENT_ keys that only some locales have are reported but not counted as failures.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
let fails = 0;
const ok = (label, cond, detail = "") => { if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`); };
const walk = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (!["node_modules", "third-party"].includes(e.name)) walk(p, out); } else out.push(p); } return out; };

// 1. Every JS file under src parses
const js = walk("src").filter(f => f.endsWith(".js"));
const bad = [];
for (const f of js) { try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { bad.push(f); } }
ok(`${js.length} JS files parse`, bad.length === 0, bad.join(", "));

// 2. Every JSON under resources parses
const jsons = walk("resources").filter(f => f.endsWith(".json"));
const badJson = jsons.filter(f => { try { JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, "")); return false; } catch (e) { return true; } });
ok(`${jsons.length} JSON files parse`, badJson.length === 0, badJson.join(", "));

// 3. All locales have the same keys as en.json
const locs = fs.readdirSync("resources/i18n").filter(f => /^[a-z-]+\.json$/.test(f) && !/-(dxcc|state)\.json$/.test(f));
const en = JSON.parse(fs.readFileSync("resources/i18n/en.json", "utf8"));
const enKeys = Object.keys(en);
for (const l of locs) {
  const j = JSON.parse(fs.readFileSync("resources/i18n/" + l, "utf8"));
  const real = (k) => !k.startsWith("COMMENT_");
  const missing = enKeys.filter(k => !(k in j)), extra = Object.keys(j).filter(k => !(k in en));
  const comments = [...missing, ...extra].filter(k => !real(k)).length;
  if (comments) console.log(`note  locale ${l}: ${comments} COMMENT_ key(s) differ from en.json`);
  const rm = missing.filter(real), rx = extra.filter(real);
  if (rm.length || rx.length) ok(`locale ${l} matches en keys`, false, `missing ${rm.length} [${rm.slice(0, 5).join(", ")}] extra ${rx.length} [${rx.slice(0, 5).join(", ")}]`);
}
ok(`${locs.length} locales checked against en.json (${enKeys.length} keys)`, true);

// 4. Every I18N("key") and data-i18n="key" used in src exists in en.json
const used = new Set();
for (const f of walk("src")) {
  if (!/\.(js|html)$/.test(f)) continue;
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(/I18N\(\s*"([^"]+)"\s*\)/g)) used.add(m[1]);
  for (const m of s.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
}
const missingUsed = [...used].filter(k => !(k in en));
ok(`${used.size} literal i18n keys used in src exist in en.json`, missingUsed.length === 0, missingUsed.join(", "));

// 5. No leftover temporary / local-server / debugger code
const leftovers = [];
for (const f of walk("src").filter(f => f.endsWith(".js") || f.endsWith(".html"))) {
  fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((l, i) => {
    if (/TEMPORARY|localOamsServer|127\.0\.0\.1:\$\{|\bdebugger;|OAMS local/.test(l)) leftovers.push(`${f}:${i + 1}`);
  });
}
ok("no TEMPORARY / local OAMS server / debugger leftovers", leftovers.length === 0, leftovers.join(", "));

// 6. Line endings and BOMs in src + i18n + data + tools + changelogs
const textFiles = [...walk("src").filter(f => /\.(js|html|css)$/.test(f)), ...walk("resources/i18n"), ...walk("tools"), "CHANGELOG.md", "HISTORY.md", "resources/data/modes.json"];
const eol = [], bom = [];
for (const f of textFiles) {
  const b = fs.readFileSync(f); const s = b.toString("utf8");
  if (b[0] === 0xEF && b[1] === 0xBB) bom.push(f);
  const lf = (s.match(/\n/g) || []).length, crlf = (s.match(/\r\n/g) || []).length;
  if (crlf && lf !== crlf) eol.push(f);
}
ok(`${textFiles.length} text files: no BOM`, bom.length === 0, bom.join(", "));
ok(`${textFiles.length} text files: no mixed line endings`, eol.length === 0, eol.join(", "));

// 7. Version, CHANGELOG.md (current work, topmost section matches package.json) and HISTORY.md (old releases)
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
ok(`package.json version ${pkg.version} has the 2.YYMMDD.N form`, /^2\.\d{6}\.\d+$/.test(pkg.version));
const cl = fs.readFileSync("CHANGELOG.md", "utf8");
const top = (cl.match(/^## \[v?([^\]]+)\]/m) || [])[1];
// Right after a release CHANGELOG.md has no version section until the next version is started
if (top === undefined) ok("CHANGELOG.md has no version section yet (just released)", true);
else ok(`CHANGELOG.md topmost section [v${top}] matches package.json`, top === pkg.version);
// UTF-8 read as Windows-1252: â€ / âœ / â— (punctuation, ✔, ◇), Ã + a Latin-1 letter (é, ê, ...), ðŸ (emoji)
const garbled = /â€|âœ|â—|Ã[\u0080-¿]|ðŸ/;
for (const f of ["CHANGELOG.md", "HISTORY.md"]) ok(`${f} has no garbled characters`, !garbled.test(fs.readFileSync(f, "utf8")));

// 8. Data files the app loads by name exist
const dataRefs = new Set();
for (const f of walk("src").filter(f => f.endsWith(".js"))) for (const m of fs.readFileSync(f, "utf8").matchAll(/requireJson\("([^"]+)"\)/g)) dataRefs.add(m[1]);
const missingData = [...dataRefs].filter(r => !fs.existsSync(path.join("resources", r)));
ok(`${dataRefs.size} requireJson data files exist`, missingData.length === 0, missingData.join(", "));

console.log(fails ? `\n${fails} FAILED` : "\nALL STATIC CHECKS PASSED");
