// Verifies i18n after edits (repo root): node tools/i18n_verify.js <file> [file ...]
// - the given files and every locale file: no BOM, no mixed line endings, JSON parses
// - every data-i18n key in the given .html files and every I18N("key") in the given .js files exists in every locale
const fs = require("fs");
const files = process.argv.slice(2);
const locs = fs.readdirSync("resources/i18n").filter((f) => /^[a-z-]+\.json$/.test(f) && !/-(dxcc|state)\.json$/.test(f));
let bad = 0;
for (const f of [...files, ...locs.map((l) => "resources/i18n/" + l)])
{
  const b = fs.readFileSync(f);
  const s = b.toString("utf8");
  const lf = (s.match(/\n/g) || []).length;
  const crlf = (s.match(/\r\n/g) || []).length;
  if ((crlf && lf !== crlf) || b[0] === 0xef)
  {
    console.log("EOL/BOM CHECK", f);
    bad++;
  }
  if (f.endsWith(".json")) JSON.parse(s);
}
const localeJson = Object.fromEntries(locs.map((l) => [l, JSON.parse(fs.readFileSync("resources/i18n/" + l, "utf8"))]));
const check = (f, re, what) =>
{
  const keys = [...new Set([...fs.readFileSync(f, "utf8").matchAll(re)].map((m) => m[1]))];
  for (const [l, j] of Object.entries(localeJson))
  {
    const missing = keys.filter((k) => !(k in j));
    if (missing.length)
    {
      console.log(`${f}: ${l} missing ${missing.length}: ${missing.slice(0, 6).join(", ")}`);
      bad++;
    }
  }
  console.log(`${f}: ${keys.length} distinct ${what} keys checked against ${locs.length} locales`);
};
for (const f of files.filter((f) => f.endsWith(".html"))) check(f, /data-i18n="([^"]+)"/g, "data-i18n");
for (const f of files.filter((f) => f.endsWith(".js"))) check(f, /I18N\(\s*"([^"]+)"\s*\)/g, "I18N");
console.log(bad ? `${bad} problems` : "all ok");
