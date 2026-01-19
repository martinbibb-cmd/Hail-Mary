import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGETS = [
  path.join(ROOT, "packages/pwa/src"),
  path.join(ROOT, "packages/pwa/public"),
];

const FORBIDDEN = [
  "main.cloudbibb.uk",
  ".workers.dev",
  "http://127.0.0.1:3001",
  "localhost:3001",
];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

let hits = [];
for (const dir of TARGETS) {
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (!/\.(ts|tsx|js|jsx|json|html|css|md)$/i.test(file)) continue;
    const txt = fs.readFileSync(file, "utf8");
    for (const f of FORBIDDEN) {
      if (txt.includes(f)) hits.push({ file, f });
    }
  }
}

if (hits.length) {
  console.error("Forbidden host(s) found:");
  for (const h of hits) console.error(`- ${h.f} in ${h.file}`);
  process.exit(1);
}
console.log("✅ Forbidden host check passed");
