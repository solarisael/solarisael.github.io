#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  parse_tag_identity,
  validate_scene_identity_consistency,
} from "../src/data/rubedo/scene_identity.js";
import { OBSIDIAN_VAULT_ROOT } from "../src/config/obsidian_vault_root.js";

const usage = `Usage:
  bun scripts/rubedo_scene_identity_audit.js check
`;

const args = process.argv.slice(2);
const mode = args[0];

if (mode !== "check") {
  console.error(usage);
  process.exit(1);
}

const scene_roots = [
  "src/data/rubedo/scenes",
  join(OBSIDIAN_VAULT_ROOT, "alchemy_writing/zzzz_rubedo"),
];
const markdown_file_paths = [];

const collect_markdown_files = (directory_path) => {
  if (!existsSync(directory_path)) {
    return;
  }

  const scenes = new Bun.Glob("**/*.md").scanSync({
    cwd: directory_path,
    absolute: true,
    onlyFiles: true,
  });
  for (const scene of scenes) {
    const scene_path = scene.replaceAll("\\", "/");
    if (!scene_path.includes("/refs/")) {
      markdown_file_paths.push(scene_path);
    }
  }
};

const strip_yaml_scalar = (raw_value = "") => {
  const trimmed_value = String(raw_value).trim();

  const quote = trimmed_value[0];
  if (`"'`.includes(quote) && trimmed_value.endsWith(quote)) {
    return trimmed_value.slice(1, -1);
  }

  return trimmed_value;
};

const extract_frontmatter = (source_text = "") => {
  const frontmatter_match = source_text.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!frontmatter_match) {
    return null;
  }

  const frontmatter_source = frontmatter_match[1];
  const frontmatter_lines = frontmatter_source.split(/\r?\n/);
  const frontmatter = {};

  for (
    let line_index = 0;
    line_index < frontmatter_lines.length;
    line_index += 1
  ) {
    const line_value = frontmatter_lines[line_index];
    const key_value_match = line_value.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);

    if (!key_value_match) {
      continue;
    }

    const frontmatter_key = key_value_match[1];
    const frontmatter_value = key_value_match[2];

    if (frontmatter_key === "tags") {
      const tags = [];

      for (
        let tag_line_index = line_index + 1;
        tag_line_index < frontmatter_lines.length;
        tag_line_index += 1
      ) {
        const tag_line_value = frontmatter_lines[tag_line_index];
        const tag_item_match = tag_line_value.match(/^\s*-\s*(.+)$/);

        if (!tag_item_match) {
          break;
        }

        tags.push(strip_yaml_scalar(tag_item_match[1]));
        line_index = tag_line_index;
      }

      frontmatter.tags = tags;
      continue;
    }

    frontmatter[frontmatter_key] = strip_yaml_scalar(frontmatter_value);
  }

  return frontmatter;
};

for (const root of scene_roots) {
  collect_markdown_files(root);
}

if (markdown_file_paths.length === 0) {
  console.error("[rubedo-scene-identity-audit] No scene files found.");
  process.exit(1);
}

const violations = [];

for (const markdown_file_path of markdown_file_paths) {
  const source_text = readFileSync(markdown_file_path, "utf8");
  const frontmatter = extract_frontmatter(source_text);

  if (!frontmatter) {
    violations.push({
      file_path: markdown_file_path,
      reason: "missing frontmatter",
    });
    continue;
  }

  const parsed_tag_identity = parse_tag_identity(frontmatter.tags ?? []);
  const identity_validation = validate_scene_identity_consistency({
    frontmatter,
    parsed_tag_identity,
  });

  if (identity_validation.is_valid) {
    continue;
  }

  const reason_parts = [];

  if (!identity_validation.has_phase_tag) {
    reason_parts.push("missing phase:rubedo");
  }

  if (identity_validation.missing_pairs.length > 0) {
    reason_parts.push(
      `missing pairs: ${identity_validation.missing_pairs
        .map(
          (identity_pair) =>
            `${identity_pair.field_label}<->${identity_pair.tag_key}`,
        )
        .join(", ")}`,
    );
  }

  if (identity_validation.mismatched_pairs.length > 0) {
    reason_parts.push(
      `mismatched pairs: ${identity_validation.mismatched_pairs
        .map(
          (identity_pair) =>
            `${identity_pair.field_label}<->${identity_pair.tag_key}`,
        )
        .join(", ")}`,
    );
  }

  violations.push({
    file_path: markdown_file_path,
    reason: reason_parts.join("; "),
  });
}

if (violations.length === 0) {
  console.log(
    `[rubedo-scene-identity-audit] OK: ${markdown_file_paths.length} scene file(s) valid.`,
  );
  process.exit(0);
}

console.error(
  `[rubedo-scene-identity-audit] Found ${violations.length} invalid scene file(s):`,
);

for (const violation of violations) {
  console.error(`- ${violation.file_path}`);
  console.error(`  ${violation.reason}`);
}

process.exit(1);
