import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolve_obsidian_vault_root } from "../../config/obsidian_vault_root.js";
const OBSIDIAN_VAULT_ROOT = resolve_obsidian_vault_root();

const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

// The vault root is shared with Astro's content loaders and Vite alias.
// URL paths use the same deploy base configured by astro.config.mjs.

// Source descriptors. `scan_root` is the absolute filesystem root; `phase`
// is the alchemical-phase label; `pattern_kind` controls which subset of
// files counts as a wikilink target (date-prefix posts, booklet records,
// valid Rubedo scenes, or any Codex markdown).
const REGISTRY_SOURCES = [
  {
    phase: "nigredo",
    scan_root: path.join(OBSIDIAN_VAULT_ROOT, "alchemy_writing/z_nigredo"),
    pattern_kind: "dated_post",
    url_strategy: "post_slug",
  },
  {
    phase: "albedo",
    scan_root: path.join(OBSIDIAN_VAULT_ROOT, "alchemy_writing/zz_albedo"),
    pattern_kind: "dated_post",
    url_strategy: "post_slug",
  },
  {
    phase: "citrinitas",
    scan_root: path.join(OBSIDIAN_VAULT_ROOT, "alchemy_writing/zzz_citrinitas"),
    pattern_kind: "citrinitas_booklet",
    url_strategy: "citrinitas_booklet",
  },
  {
    phase: "rubedo",
    scan_root: path.join(OBSIDIAN_VAULT_ROOT, "alchemy_writing/zzzz_rubedo"),
    pattern_kind: "any_markdown",
    url_strategy: "rubedo_scene",
  },
  {
    phase: "rubedo",
    scan_root: path.join(PROJECT_ROOT, "src", "content", "rubedo"),
    pattern_kind: "any_markdown",
    url_strategy: "rubedo_scene",
  },
  {
    phase: "codex",
    scan_root: path.join(OBSIDIAN_VAULT_ROOT, "codex"),
    pattern_kind: "any_markdown",
    url_strategy: "codex_entry_path",
  },
];
const DATE_PREFIX_RE = /^[0-9]{4}-/;
const file_matches_source_pattern = (source, file_name) => {
  if (source.pattern_kind === "dated_post") {
    return DATE_PREFIX_RE.test(file_name) && file_name.endsWith(".md");
  }
  return file_name.endsWith(".md");
};

const normalized_path = (file_path) =>
  path.resolve(file_path).replaceAll("\\", "/").toLowerCase();

const is_rubedo_ref_file = (source, file_path) => {
  if (source.url_strategy !== "rubedo_scene") {
    return false;
  }

  const relative_path = path
    .relative(source.scan_root, file_path)
    .replaceAll(path.sep, "/")
    .toLowerCase();

  return relative_path.split("/").includes("refs");
};

const is_wikilink_registry_source = (file_path = "") => {
  if (typeof file_path !== "string" || !file_path.trim()) {
    return false;
  }

  const changed_path = normalized_path(file_path);
  return REGISTRY_SOURCES.some((source) => {
    const source_root = normalized_path(source.scan_root);
    if (
      source.url_strategy === "rubedo_scene" &&
      is_rubedo_ref_file(source, file_path)
    ) {
      return false;
    }
    return (
      changed_path === source_root || changed_path.startsWith(`${source_root}/`)
    );
  });
};

const walk_markdown_files = (scan_root) => {
  if (!fs.existsSync(scan_root)) {
    return [];
  }
  const out = [];
  const stack = [scan_root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const child_path = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(child_path);
        continue;
      }
      if (entry.isFile()) {
        out.push(child_path);
      }
    }
  }
  return out;
};
const is_doc_file_to_skip = (file_stem) => {
  // README and _template files are convention-doc files, not posts.
  // They live alongside content but should never resolve via wikilinks.
  const stem_lower = file_stem.toLowerCase();
  return stem_lower === "readme" || stem_lower.startsWith("_template");
};
const read_source_file = (source, file_path) => {
  const file_name = path.basename(file_path);
  if (!file_matches_source_pattern(source, file_name)) return null;
  if (is_rubedo_ref_file(source, file_path)) return null;
  const file_stem = file_name.replace(/\.md$/i, "");
  if (is_doc_file_to_skip(file_stem)) return null;
  try {
    return {
      file_stem,
      file_path,
      raw_body: fs.readFileSync(file_path, "utf8"),
    };
  } catch {
    return null;
  }
};
export {
  REGISTRY_SOURCES,
  is_wikilink_registry_source,
  walk_markdown_files,
  read_source_file,
};
