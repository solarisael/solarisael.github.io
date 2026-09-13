#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { measure_source, exceeds_budget } from "./code_quality/source.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const source_roots = ["src", "public/js", "scripts"];
const files = new Set(["astro.config.mjs"]);

for (const directory of source_roots) {
  const pattern = new Bun.Glob(`${directory}/**/*.{js,mjs,ts,astro,py}`);
  for (const path of pattern.scanSync({ cwd: root, onlyFiles: true })) {
    const file = path.replaceAll("\\", "/");
    if (file.startsWith("public/js/vendor/")) continue;
    if (/\.(test|spec)\.[cm]?[jt]s$/.test(file)) continue;
    if (/(^|\/)(__tests__|tests)\//.test(file)) continue;
    files.add(file);
  }
}

const measurements = [];
const python_files = [];
for (const file of [...files].sort()) {
  if (file.endsWith(".py")) {
    python_files.push(file);
    continue;
  }
  measurements.push(
    await measure_source(
      file,
      readFileSync(new URL(file, new URL("../", import.meta.url)), "utf8"),
    ),
  );
}

if (python_files.length > 0) {
  const result = Bun.spawnSync(
    ["python", "scripts/code_quality/python.py", ...python_files],
    { cwd: root },
  );
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr));
  }
  const python_measurements = JSON.parse(
    new TextDecoder().decode(result.stdout),
  );
  if (python_measurements.length !== python_files.length) {
    throw new Error(
      "Python source measurement did not cover every declared file.",
    );
  }
  measurements.push(...python_measurements);
}

const violations = measurements.filter(exceeds_budget);
const function_count = measurements.reduce(
  (sum, entry) => sum + entry.functions.length,
  0,
);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ files: measurements, violations }, null, 2));
} else {
  for (const entry of violations) {
    console.error(
      `${entry.file}: max=${entry.max_ccn}, average=${entry.average_ccn.toFixed(2)}, decisions=${entry.decisions}, above_10=${entry.above_10}`,
    );
    for (const error of entry.errors)
      console.error(`  ${error.line}: ${error.message}`);
  }
  console.log(
    `[code-quality] ${measurements.length} files, ${function_count} functions, ${violations.length} violations. LOC is a review signal.`,
  );
}

process.exitCode = violations.length === 0 ? 0 : 1;
