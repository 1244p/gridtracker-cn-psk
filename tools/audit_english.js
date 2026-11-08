// Audit: English-only UI strings of two or more words, not going through i18n (src/renderer HTML and lib JS,
// skipping third-party). Heuristic: expect some false positives (callsigns, units, debug text).
// Usage: node tools/audit_english.js [repoRoot] [outFile]   (defaults: ".", english_audit.txt in the OS temp folder)
// Prints a per-file summary; the full list (file, line, kind, text) goes to outFile.
const fs = require("fs");
const os = require("os");
const path = require("path");
const root = process.argv[2] || ".";
const outFile = process.argv[3] || path.join(os.tmpdir(), "english_audit.txt");
const en = JSON.parse(fs.readFileSync(path.join(root, "resources/i18n/en.json"), "utf8"));
// Proper nouns (brands, callsigns, contributor names, language endonyms) that are meant to stay as
// they are: one per line, "#" starts a comment. They are reported as a count, not as failures.
const allowFile = path.join(root, "tools/english_allowlist.txt");
const allow = new Set(fs.existsSync(allowFile)
  ? fs.readFileSync(allowFile, "utf8").split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#"))
  : []);

const WORDS = /[A-Za-z][A-Za-z'’-]*/g;
const multiWord = (s) => (s.replace(/&[a-z#0-9]+;/gi, " ").match(WORDS) || []).length >= 2;
const clean = (s) => s.replace(/\s+/g, " ").trim();
const results = []; // { file, line, kind, text }
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

// ---------- HTML ----------
// Text is translated when its nearest element has a data-i18n key that isn't .hover; a title is translated when the
// element's key ends in .hover, or ends in .label with a matching .hover key in en.json
function auditHtml(file) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const stack = []; // { tag, i18n }
  const VOID = new Set(["br", "img", "input", "hr", "meta", "link", "source", "col", "area", "base", "wbr", "option-x"]);
  const tagRe = /<!--[\s\S]*?-->|<![^>]*>|<(\/?)([a-zA-Z0-9-]+)([^>]*?)(\/?)>/g;
  let last = 0, m;
  let skipUntil = null;
  while ((m = tagRe.exec(src))) {
    const text = src.slice(last, m.index);
    last = tagRe.lastIndex;
    if (m[0].startsWith("<!")) continue;
    const closing = m[1] === "/", tag = m[2].toLowerCase(), attrs = m[3] || "";
    if (skipUntil) { if (closing && tag === skipUntil) skipUntil = null; continue; }
    // Text before this tag belongs to the current top of stack
    const t = clean(text);
    if (t && multiWord(t) && !/^[\s\d.,:;|()\-+/%&#;a-z]*$/.test(t) /* skip pure symbols */) {
      // Translated when any enclosing element has a non-.hover key: its innerHTML is replaced as a whole
      const translated = stack.some(el => el.i18n && !el.i18n.endsWith(".hover"));
      if (!translated) results.push({ file: rel, line: lineOf(src, m.index - text.length + text.indexOf(t.split(" ")[0])), kind: "html text", text: t });
    }
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    if (tag === "script" || tag === "style") { if (!m[4]) skipUntil = tag; continue; }
    const i18n = (attrs.match(/data-i18n\s*=\s*["']([^"']+)["']/) || [])[1] || null;
    const titleI18n = (attrs.match(/data-i18n-title\s*=\s*["']([^"']+)["']/) || [])[1] || null;
    const titleM = attrs.match(/\btitle\s*=\s*"([^"]*)"|\btitle\s*=\s*'([^']*)'/);
    if (titleM) {
      const title = clean(titleM[1] !== undefined ? titleM[1] : titleM[2]);
      const titleTranslated = (titleI18n && (titleI18n in en)) || (i18n && (i18n.endsWith(".hover") || (i18n.endsWith(".label") && (i18n.replace(/\.label$/, ".hover") in en))));
      if (title && multiWord(title) && !titleTranslated) results.push({ file: rel, line: lineOf(src, m.index), kind: "html title", text: title });
    }
    for (const a of ["placeholder", "alt"]) {
      const am = attrs.match(new RegExp("\\b" + a + "\\s*=\\s*\"([^\"]*)\""));
      if (am && multiWord(am[1])) results.push({ file: rel, line: lineOf(src, m.index), kind: "html " + a, text: clean(am[1]) });
    }
    if (!VOID.has(tag) && !m[4]) stack.push({ tag, i18n });
  }
}

// ---------- JS ----------
// String literals that reach the screen without I18N(): HTML text inside strings, and literals assigned to or passed as
// UI text. Lines that are comments or console/log output are skipped
function auditJs(file) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const lines = src.split(/\r?\n/);
  const UI_CONTEXT = /(innerHTML|innerText|textContent|\.title|\btitle\s*:|\blabel\s*:|\btooltip\s*:|\btext\s*:|\bhtml\s*:|alert\(|confirm\(|addLastTraffic\(|showMessageBox|setStatus|\.value\s*=|makeRow\(|html\.push\(|createCellHtml|newOption\()/;
  const STR = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) return;
    if (/console\.(log|error|warn|info)|\blog\.(info|error|warn)|logError\(|throw new|require\(|new RegExp|\.test\(|\.match\(|\.replace\(/.test(line) && !UI_CONTEXT.test(line)) return;
    let s;
    STR.lastIndex = 0;
    while ((s = STR.exec(raw))) {
      let lit = s[1] !== undefined ? s[1] : (s[2] !== undefined ? s[2] : s[3]);
      if (!lit) continue;
      // HTML text between tags inside the literal (e.g. "<th>Spot Time</th>")
      const htmlTexts = [...lit.replace(/\$\{[^}]*\}/g, " ").matchAll(/>([^<>]+)</g)].map(x => clean(x[1])).filter(x => multiWord(x) && /[A-Za-z]{2}/.test(x));
      for (const t of htmlTexts) results.push({ file: rel, line: i + 1, kind: "js html", text: t });
      // Whole literal as UI text when the line is a UI context and the literal reads like words
      const plain = clean(lit.replace(/\$\{[^}]*\}/g, " ").replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " "));
      if (htmlTexts.length === 0 && UI_CONTEXT.test(raw) && multiWord(plain) && /^[A-Z(]/.test(plain) && !/[{};=]|^[a-z-]+:/.test(lit) && !/I18N\(\s*$/.test(raw.slice(0, s.index))) {
        results.push({ file: rel, line: i + 1, kind: "js text", text: plain });
      }
    }
  });
}

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "third-party") walk(p, out); }
    else out.push(p);
  }
  return out;
};
const renderer = path.join(root, "src/renderer");
for (const f of fs.readdirSync(renderer).filter(f => f.endsWith(".html"))) auditHtml(path.join(renderer, f));
for (const f of walk(path.join(renderer, "lib")).filter(f => f.endsWith(".js"))) auditJs(f);

// De-duplicate identical text on the same line
const seen = new Set();
const unique = results.filter(r => { const k = r.file + ":" + r.line + ":" + r.text; if (seen.has(k)) return false; seen.add(k); return true; });
const allowlisted = unique.filter(r => allow.has(r.text));
const failures = unique.filter(r => !allow.has(r.text));
const byFile = {};
for (const r of failures) (byFile[r.file] = byFile[r.file] || []).push(r);
const out = [];
out.push(`English-only UI strings (2+ words, not through i18n): ${failures.length}`);
out.push(`Allowlisted proper nouns: ${allowlisted.length} (see tools/english_allowlist.txt)`);
for (const f of Object.keys(byFile).sort((a, b) => byFile[b].length - byFile[a].length)) {
  out.push("", `## ${f} (${byFile[f].length})`);
  for (const r of byFile[f]) out.push(`  ${String(r.line).padStart(5)}  [${r.kind}]  ${r.text.slice(0, 110)}`);
}
fs.writeFileSync(outFile, out.join("\n"), "utf8");
console.log(out[0] + "  (full list: " + outFile + ")");
for (const f of Object.keys(byFile).sort((a, b) => byFile[b].length - byFile[a].length)) console.log(String(byFile[f].length).padStart(5), f);
const kinds = {};
for (const r of unique) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
console.log("by kind:", JSON.stringify(kinds));
