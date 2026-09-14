import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { NIGREDO_STATES } from "../src/data/nigredo_taxonomy.js";
import { resolve_obsidian_vault_root } from "../src/config/obsidian_vault_root.js";

const PHASE_DIRS = {
  nigredo: "alchemy_writing/z_nigredo",
};

const args = parse_args(process.argv.slice(2));
const phase = args._[0];

if (args.help) print_help_and_exit(0);
if (!phase) print_help_and_exit(1);
if (!Object.hasOwn(PHASE_DIRS, phase)) fail(`unsupported phase: ${phase}`);

const slug = required_arg("slug");
const date = args.date ?? new Date().toISOString().slice(0, 10);
const states = parse_states(args.states);
const title = args.title;
const excerpt = args.excerpt;
const body = args.body ?? "";

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("date must be YYYY-MM-DD");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  fail("slug must be kebab-case: lowercase letters, numbers, and hyphens");
}

const vault_root = resolve_obsidian_vault_root();
const target_dir = path.join(
  vault_root,
  PHASE_DIRS[phase],
  date.slice(0, 4),
  date.slice(5, 7),
);
const target_file = path.join(
  target_dir,
  `${date}_${slug.replaceAll("-", "_")}.md`,
);

if (existsSync(target_file)) fail(`post already exists: ${target_file}`);

mkdirSync(target_dir, { recursive: true });
writeFileSync(target_file, render_nigredo_post(), "utf8");

console.log(target_file);

function parse_args(raw_args) {
  const parsed = { _: [] };
  for (const arg of raw_args) {
    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }

    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length > 0 ? rest.join("=") : true;
  }
  return parsed;
}

function required_arg(name) {
  const value = args[name];
  if (!value || value === true) fail(`missing --${name}`);
  return value;
}

function parse_states(raw_states) {
  if (!raw_states || raw_states === true) fail("missing --states");

  const selected = raw_states
    .split(",")
    .map((state) => state.trim())
    .filter(Boolean);

  if (selected.length === 0) fail("--states needs at least one state");

  const invalid = selected.filter((state) => !NIGREDO_STATES.includes(state));
  if (invalid.length > 0) {
    fail(`invalid Nigredo state(s): ${invalid.join(", ")}`);
  }

  return [...new Set(selected)];
}

function render_nigredo_post() {
  const lines = ["---"];
  if (title) lines.push(`title: "${yaml_string(title)}"`);
  lines.push(`slug: "${slug}"`);
  lines.push(`published_at: "${date}"`);
  lines.push("states:");
  for (const state of states) lines.push(`  - ${state}`);
  if (excerpt) lines.push(`excerpt: "${yaml_string(excerpt)}"`);
  lines.push("---", "", body);
  return `${lines.join("\n").trimEnd()}\n`;
}

function yaml_string(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function print_help_and_exit(code) {
  console.log(`Usage:
  bun run new:post nigredo --slug=some-slug --states=grief,doubt [--title="Title"] [--excerpt="One line"] [--date=YYYY-MM-DD]

Nigredo states:
  ${NIGREDO_STATES.join(", ")}`);
  process.exit(code);
}

function fail(message) {
  console.error(`new post failed: ${message}`);
  process.exit(1);
}
