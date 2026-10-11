// Converts the "### MD Markup Format" section of CHANGELOG.md to HTML and writes it into the "### HTML List" section
// (as an ```html fenced block, replacing any previous one). Dry run (prints the HTML) unless "write".
// Usage (repo root): node tools/changelog_html.js [write]
// The MD section may only hold "#### Area" headings and "- " bullets nested by two spaces; anything else stops it.
const fs = require("fs");
const write = process.argv[2] === "write";
const f = "CHANGELOG.md";
let s = fs.readFileSync(f, "utf8");
const nl = s.includes("\r\n") ? "\r\n" : "\n";
const fail = (msg) =>
{
  console.log(msg + " - nothing written");
  process.exit(1);
};

const mdHead = "### MD Markup Format" + nl;
const htmlHead = "### HTML List" + nl;
const a = s.indexOf(mdHead);
const b = s.indexOf(htmlHead);
if (a < 0 || b < 0 || b < a || s.indexOf(mdHead, a + 1) >= 0 || s.indexOf(htmlHead, b + 1) >= 0) fail("need one MD Markup Format heading followed by one HTML List heading");

// The HTML List section runs to the next "## " / "### " heading or the end of the file
const afterHead = b + htmlHead.length;
const nextHead = s.slice(afterHead).search(/^#{2,3} /m);
const sectionEnd = nextHead < 0 ? s.length : afterHead + nextHead;
const section = s.slice(afterHead, sectionEnd).trim();
if (section !== "" && !/^```html\r?\n[\s\S]*\r?\n```$/.test(section)) fail("HTML List section holds something other than one ```html block");

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const out = [];
let depth = 0; // open <ul> levels
const pad = (n) => "  ".repeat(n);
const closeTo = (d) =>
{
  while (depth > d)
  {
    out.push(pad(depth * 2 - 1) + "</li>");
    out.push(pad(depth * 2 - 2) + "</ul>");
    depth--;
  }
};

for (const line of s.slice(a + mdHead.length, b).split(nl))
{
  if (line.trim() === "") continue;
  const h = line.match(/^#### (.*)$/);
  if (h)
  {
    closeTo(0);
    out.push("<h4>" + esc(h[1]) + "</h4>");
    continue;
  }
  const li = line.match(/^( *)- (.*)$/);
  if (!li) fail("unexpected line: " + JSON.stringify(line));
  if (li[1].length % 2) fail("odd indent: " + JSON.stringify(line));
  const level = li[1].length / 2 + 1;
  if (level > depth + 1) fail("indent jump: " + JSON.stringify(line));
  if (level === depth + 1)
  {
    out.push(pad(level * 2 - 2) + "<ul>");
    depth = level;
  }
  else
  {
    closeTo(level);
    out.push(pad(level * 2 - 1) + "</li>");
  }
  out.push(pad(level * 2 - 1) + "<li>" + esc(li[2]));
}
closeTo(0);

// Items without a sub-list close on their own line: <li>text</li>
for (let i = out.length - 1; i > 0; i--)
{
  if (out[i].trim() === "</li>" && out[i - 1].trim().startsWith("<li>"))
  {
    out[i - 1] += "</li>";
    out.splice(i, 1);
  }
}

const html = "```html" + nl + out.join(nl) + nl + "```" + nl;
const count = (re) => (html.match(re) || []).length;
const unbalanced = ["ul", "li", "h4"].filter((t) => count(new RegExp("<" + t + ">", "g")) !== count(new RegExp("</" + t + ">", "g")));
if (unbalanced.length) fail("unbalanced tags: " + unbalanced.join(", "));

if (!write)
{
  console.log(html.replace(/\r/g, ""));
  console.log(`dry run ok: ${count(/<li>/g)} items, ${count(/<h4>/g)} areas`);
}
else
{
  const tail = s.slice(sectionEnd);
  s = s.slice(0, afterHead) + nl + html + (tail ? nl + tail : "");
  fs.writeFileSync(f, s);
  console.log(`written: ${count(/<li>/g)} items, ${count(/<h4>/g)} areas`);
}
