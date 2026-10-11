// Applies an i18n batch: line-anchored HTML/JS edits plus new keys in every locale. Dry run unless "write".
// Usage (repo root): node tools/i18n_apply.js <batch.js> [write]
//
// The batch is a CommonJS module:
//   module.exports = {
//     edits: [{ file, line, find, replace, all }],  // `find` must be on line..line+3 of `file` (1-based); all: replace every hit on that line
//     keys: { "some.key.label": [13 values, in LOCALES order below] },
//     copy: { "new.key": "existing.key" },          // optional: per-locale copy of an existing key's value
//     fixEn: { "existing.key": "New English" }      // optional: replace an existing en.json value
//   };
// Nothing is written if anything doesn't match (missing anchor, existing key, wrong value count).
const fs = require("fs");
const path = require("path");
const batch = require(path.resolve(process.argv[2]));
const write = process.argv[3] === "write";
const LOCALES = ["en", "de", "es", "fr", "fr-ca", "it", "pt-br", "pt-pt", "nl", "pl", "ja", "cn", "cn-t"];
let problems = 0;

// LOCALES must be exactly the UI locale files (not the -dxcc / -state name files)
const onDisk = fs.readdirSync("resources/i18n").filter((f) => /^[a-z-]+\.json$/.test(f) && !/-(dxcc|state)\.json$/.test(f)).map((f) => f.slice(0, -5));
const notListed = onDisk.filter((l) => !LOCALES.includes(l));
const notOnDisk = LOCALES.filter((l) => !onDisk.includes(l));
if (notListed.length || notOnDisk.length)
{
  console.log(`LOCALES out of date: not listed [${notListed}], not on disk [${notOnDisk}]`);
  process.exit(1);
}

// ---- Source edits
const byFile = {};
for (const e of batch.edits || []) (byFile[e.file] = byFile[e.file] || []).push(e);
const sourceOut = {};
for (const [file, edits] of Object.entries(byFile))
{
  const src = fs.readFileSync(file, "utf8");
  const nl = src.includes("\r\n") ? "\r\n" : "\n";
  const lines = src.split(nl);
  for (const e of edits)
  {
    let done = false;
    for (let i = e.line - 1; i < Math.min(lines.length, e.line + 3) && !done; i++)
    {
      if (lines[i].includes(e.find))
      {
        lines[i] = e.all ? lines[i].split(e.find).join(e.replace) : lines[i].replace(e.find, e.replace);
        done = true;
      }
    }
    if (!done)
    {
      console.log(`NOT FOUND ${file}:${e.line}  ${e.find}`);
      problems++;
    }
  }
  sourceOut[file] = lines.join(nl);
  console.log(`${file}: ${edits.length} edits, ${src.length} -> ${sourceOut[file].length} chars`);
}

// ---- Keys
const keys = batch.keys || {};
const files = {};
for (const loc of LOCALES)
{
  const f = path.join("resources/i18n", loc + ".json");
  files[loc] = { f, src: fs.readFileSync(f, "utf8") };
  files[loc].json = JSON.parse(files[loc].src);
}
for (const [k, vals] of Object.entries(keys))
{
  if (vals.length !== LOCALES.length)
  {
    console.log("WRONG COUNT", k, vals.length);
    problems++;
  }
  for (const loc of LOCALES)
  {
    if (k in files[loc].json)
    {
      console.log("EXISTS", loc, k);
      problems++;
    }
  }
}
for (const from of Object.values(batch.copy || {}))
{
  for (const loc of LOCALES)
  {
    if (!(from in files[loc].json))
    {
      console.log("COPY SOURCE MISSING", loc, from);
      problems++;
    }
  }
}
const localeOut = {};
for (const loc of LOCALES)
{
  const { src, json } = files[loc];
  const nl = src.includes("\r\n") ? "\r\n" : "\n";
  const indent = (src.match(/\n(\s+)"/) || [, "  "])[1];
  let text = src;
  if (loc === "en")
  {
    for (const [k, v] of Object.entries(batch.fixEn || {}))
    {
      const re = new RegExp('("' + k.replace(/\./g, "\\.") + '": )"(?:[^"\\\\]|\\\\.)*"');
      if (!re.test(text))
      {
        console.log("FIXEN KEY MISSING", k);
        problems++;
      }
      text = text.replace(re, "$1" + JSON.stringify(v));
    }
  }
  const add = [];
  for (const [k, from] of Object.entries(batch.copy || {})) add.push([k, json[from]]);
  const idx = LOCALES.indexOf(loc);
  for (const [k, vals] of Object.entries(keys)) add.push([k, vals[idx]]);
  if (add.length)
  {
    // Append before the closing brace (the last key gains a comma)
    const closeIdx = text.lastIndexOf("}");
    let head = text.slice(0, closeIdx).replace(/\s*$/, "");
    head += "," + nl + add.map(([k, v]) => `${indent}${JSON.stringify(k)}: ${JSON.stringify(v)}`).join("," + nl) + nl;
    text = head + text.slice(closeIdx);
  }
  const parsed = JSON.parse(text);
  const added = Object.keys(parsed).length - Object.keys(json).length;
  if (added !== add.length)
  {
    console.log("ADD COUNT MISMATCH", loc, added, add.length);
    problems++;
  }
  localeOut[loc] = text;
  console.log(`${loc.padEnd(6)} +${added} keys`);
}

if (problems)
{
  console.log(`${problems} PROBLEMS - nothing written`);
}
else if (write)
{
  for (const [file, out] of Object.entries(sourceOut)) fs.writeFileSync(file, out, "utf8");
  for (const loc of LOCALES) if (localeOut[loc] !== files[loc].src) fs.writeFileSync(files[loc].f, localeOut[loc], "utf8");
  console.log("written");
}
else
{
  console.log("dry run ok");
}
