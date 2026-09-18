#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";

const usage = `Usage:
  bun scripts/css_tunables.js check <file> [--selector=#mobile-nav] [--prefix=mobile_] [--ignore=name_a,name_b]
  bun scripts/css_tunables.js sync <file> [--selector=#mobile-nav] [--prefix=mobile_] [--ignore=name_a,name_b]
`;

const args = process.argv.slice(2);
const mode = args[0];
const file_path = args[1];

if (!(mode === "check" || mode === "sync") || !file_path) {
  console.error(usage);
  process.exit(1);
}

const options = args.slice(2).reduce(
  (accumulator, argument_value) => {
    if (argument_value.startsWith("--selector=")) {
      return {
        ...accumulator,
        selector: argument_value.slice("--selector=".length),
      };
    }

    if (argument_value.startsWith("--prefix=")) {
      return {
        ...accumulator,
        prefix: argument_value.slice("--prefix=".length),
      };
    }

    if (argument_value.startsWith("--ignore=")) {
      return {
        ...accumulator,
        ignored_names: argument_value
          .slice("--ignore=".length)
          .split(",")
          .map((name_value) => name_value.trim())
          .filter(Boolean),
      };
    }

    return accumulator;
  },
  {
    selector: "#mobile-nav",
    prefix: "mobile_",
    ignored_names: [],
  },
);

const ignored_name_set = new Set(options.ignored_names);

const css_source = readFileSync(file_path, "utf8");

const escape_regex = (raw_value) =>
  raw_value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const selector_pattern = new RegExp(
  `^\\s*${escape_regex(options.selector)}\\s*\\{\\s*$`,
  "m",
);
const selector_match = selector_pattern.exec(css_source);

if (!selector_match) {
  console.error(
    `[css-tunables] Could not find selector block for ${options.selector} in ${file_path}.`,
  );
  process.exit(1);
}

const selector_line_start = selector_match.index;
const block_open_index = css_source.indexOf("{", selector_line_start);

if (block_open_index === -1) {
  console.error(`[css-tunables] Invalid block for ${options.selector}.`);
  process.exit(1);
}

let cursor_index = block_open_index;
let brace_depth = 0;
let block_close_index = -1;

for (; cursor_index < css_source.length; cursor_index += 1) {
  const current_character = css_source[cursor_index];

  if (current_character === "{") {
    brace_depth += 1;
  } else if (current_character === "}") {
    brace_depth -= 1;

    if (brace_depth === 0) {
      block_close_index = cursor_index;
      break;
    }
  }
}

if (block_close_index === -1) {
  console.error(`[css-tunables] Unclosed block for ${options.selector}.`);
  process.exit(1);
}

const top_media_index = css_source.search(/^\s*@media/m);

if (top_media_index !== -1 && selector_line_start > top_media_index) {
  console.error(
    `[css-tunables] ${options.selector} block must appear before the first @media in ${file_path}.`,
  );
  process.exit(1);
}

const selector_block_source = css_source.slice(
  block_open_index + 1,
  block_close_index,
);
const declaration_matches = [
  ...selector_block_source.matchAll(/--([a-z0-9_-]+)\s*:/gi),
].map((match_value) => match_value[1]);
const declared_variable_names = new Set(
  declaration_matches.filter((name_value) =>
    name_value.startsWith(options.prefix),
  ),
);

const variable_usage_matches = [
  ...css_source.matchAll(/var\(\s*--([a-z0-9_-]+)/gi),
].map((match_value) => match_value[1]);
const used_variable_names = new Set(
  variable_usage_matches.filter((name_value) =>
    name_value.startsWith(options.prefix),
  ),
);

const missing_variable_names = [...used_variable_names]
  .filter(
    (name_value) =>
      !declared_variable_names.has(name_value) &&
      !ignored_name_set.has(name_value),
  )
  .sort();

if (mode === "check") {
  if (missing_variable_names.length > 0) {
    console.error(
      `[css-tunables] Missing top declarations in ${file_path} (${options.selector}):`,
    );
    missing_variable_names.forEach((name_value) => {
      console.error(`  --${name_value}`);
    });
    process.exit(1);
  }

  console.log(
    `[css-tunables] OK: ${file_path} exposes all --${options.prefix}* variables in ${options.selector}.`,
  );
  process.exit(0);
}

if (missing_variable_names.length === 0) {
  console.log(
    `[css-tunables] No missing --${options.prefix}* declarations found in ${file_path}.`,
  );
  process.exit(0);
}

const insertion_lines = missing_variable_names
  .map((name_value) => `  --${name_value}: initial;`)
  .join("\n");
const separator = selector_block_source.endsWith("\n") ? "" : "\n";

const patched_block_source = `${selector_block_source}${separator}${insertion_lines}\n`;
const patched_css_source = `${css_source.slice(0, block_open_index + 1)}${patched_block_source}${css_source.slice(block_close_index)}`;

writeFileSync(file_path, patched_css_source, "utf8");

console.log(
  `[css-tunables] Added ${missing_variable_names.length} declaration(s) to ${options.selector} in ${file_path}.`,
);
