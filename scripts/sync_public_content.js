import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  LOCAL_CONTENT_ROOT,
  resolve_obsidian_vault_root,
} from "../src/config/obsidian_vault_root.js";

const DESTINATION_ROOT = path.resolve(LOCAL_CONTENT_ROOT);
const MANIFEST_PATH = path.join(
  DESTINATION_ROOT,
  ".public-content-manifest.json",
);
const MANIFEST_SCHEMA = 1;

const PUBLIC_ROOTS = Object.freeze([
  {
    source: "alchemy_writing/z_nigredo",
    destination: "alchemy_writing/z_nigredo",
    posts_only: true,
  },
  {
    source: "alchemy_writing/zz_albedo",
    destination: "alchemy_writing/zz_albedo",
    posts_only: true,
  },
  {
    source: "alchemy_writing/zzz_citrinitas",
    destination: "alchemy_writing/zzz_citrinitas",
    posts_only: false,
  },
  {
    source: "alchemy_writing/zzzz_rubedo",
    destination: "alchemy_writing/zzzz_rubedo",
    posts_only: false,
  },
  { source: "codex", destination: "codex", posts_only: false },
]);

const IGNORED_FILE_NAMES = new Set([".gitkeep", "README.md", "_template.md"]);
const IGNORED_DIRECTORY_NAMES = new Set([".obsidian", "refs"]);
const POST_FILE_PATTERN = /^\d{4}-.*\.md$/i;
const FRONTMATTER_PATTERN = /^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const DRAFT_PATTERN = /^draft\s*:\s*(?:true|yes|on)(?:\s+#.*)?\s*$/im;

const to_manifest_path = (path_value) => path_value.replaceAll("\\", "/");
const sha256 = (contents) =>
  createHash("sha256").update(contents).digest("hex");

const classify_markdown = (absolute_path) => {
  const contents = readFileSync(absolute_path, "utf8");
  if (contents.trim().length === 0) {
    return { publish: false, reason: "empty" };
  }

  const frontmatter_match = contents.match(FRONTMATTER_PATTERN);
  if (!frontmatter_match) {
    throw new Error(
      `[content:sync] publishable markdown has no YAML frontmatter: ${absolute_path}`,
    );
  }

  if (DRAFT_PATTERN.test(frontmatter_match[1])) {
    return { publish: false, reason: "draft" };
  }

  return { publish: true, reason: null };
};

const collect_source_files = ({ source_root, posts_only }) => {
  const files = [];
  const skipped = [];

  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }

      const absolute_path = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute_path);
        continue;
      }
      if (!entry.isFile() || IGNORED_FILE_NAMES.has(entry.name)) continue;

      const relative_path = path.relative(source_root, absolute_path);
      if (entry.name.toLowerCase().endsWith(".md")) {
        if (posts_only && !POST_FILE_PATTERN.test(entry.name)) continue;

        const markdown = classify_markdown(absolute_path);
        if (!markdown.publish) {
          skipped.push({ path: relative_path, reason: markdown.reason });
          continue;
        }
      }

      files.push({ absolute_path, relative_path });
    }
  };

  visit(source_root);
  return { files, skipped };
};

const collect_destination_files = () => {
  const files = [];

  const visit = (directory, destination_root) => {
    if (!existsSync(directory)) return;

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute_path = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute_path, destination_root);
      } else if (entry.isFile()) {
        files.push(
          to_manifest_path(path.relative(destination_root, absolute_path)),
        );
      }
    }
  };

  for (const public_root of PUBLIC_ROOTS) {
    const destination_root = path.join(
      DESTINATION_ROOT,
      public_root.destination,
    );
    visit(destination_root, DESTINATION_ROOT);
  }

  return files.sort((left, right) => left.localeCompare(right));
};

const sync_public_content = () => {
  const source_root = path.resolve(resolve_obsidian_vault_root());
  if (source_root === DESTINATION_ROOT) {
    throw new Error(
      "[content:sync] external Obsidian vault unavailable; refusing to sync the checked-in mirror onto itself",
    );
  }

  const manifest_files = [];
  const skipped_files = [];

  for (const public_root of PUBLIC_ROOTS) {
    const source_directory = path.join(source_root, public_root.source);
    if (
      !existsSync(source_directory) ||
      !statSync(source_directory).isDirectory()
    ) {
      throw new Error(
        `[content:sync] public vault root is missing: ${source_directory}`,
      );
    }

    const destination_directory = path.join(
      DESTINATION_ROOT,
      public_root.destination,
    );
    rmSync(destination_directory, { recursive: true, force: true });
    mkdirSync(destination_directory, { recursive: true });

    const collected = collect_source_files({
      source_root: source_directory,
      posts_only: public_root.posts_only,
    });

    for (const source_file of collected.files) {
      const destination_path = path.join(
        destination_directory,
        source_file.relative_path,
      );
      mkdirSync(path.dirname(destination_path), { recursive: true });
      copyFileSync(source_file.absolute_path, destination_path);

      const manifest_path = to_manifest_path(
        path.relative(DESTINATION_ROOT, destination_path),
      );
      manifest_files.push({
        path: manifest_path,
        sha256: sha256(readFileSync(destination_path)),
      });
    }

    for (const skipped_file of collected.skipped) {
      skipped_files.push({
        path: to_manifest_path(
          path.join(public_root.source, skipped_file.path),
        ),
        reason: skipped_file.reason,
      });
    }
  }

  manifest_files.sort((left, right) => left.path.localeCompare(right.path));
  skipped_files.sort((left, right) => left.path.localeCompare(right.path));

  const manifest = {
    schema: MANIFEST_SCHEMA,
    roots: PUBLIC_ROOTS.map(({ destination }) => destination),
    files: manifest_files,
  };
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `[content:sync] staged ${manifest_files.length} public files from ${PUBLIC_ROOTS.length} vault roots`,
  );
  for (const skipped_file of skipped_files) {
    console.log(
      `[content:sync] skipped ${skipped_file.reason}: ${skipped_file.path}`,
    );
  }
};

const check_public_content = () => {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(
      `[content:check] missing public content manifest: ${MANIFEST_PATH}`,
    );
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  if (manifest.schema !== MANIFEST_SCHEMA || !Array.isArray(manifest.files)) {
    throw new Error("[content:check] unsupported public content manifest");
  }

  const expected_roots = PUBLIC_ROOTS.map(({ destination }) => destination);
  if (JSON.stringify(manifest.roots) !== JSON.stringify(expected_roots)) {
    throw new Error(
      "[content:check] manifest roots do not match the public roots",
    );
  }

  const expected_paths = manifest.files.map((file) => file.path);
  const actual_paths = collect_destination_files();
  if (JSON.stringify(actual_paths) !== JSON.stringify(expected_paths)) {
    throw new Error(
      "[content:check] staged content paths differ from the public content manifest; run bun run content:sync",
    );
  }

  for (const file of manifest.files) {
    const absolute_path = path.join(DESTINATION_ROOT, file.path);
    const actual_hash = sha256(readFileSync(absolute_path));
    if (actual_hash !== file.sha256) {
      throw new Error(
        `[content:check] staged content changed without a sync: ${file.path}`,
      );
    }
  }

  console.log(
    `[content:check] ${manifest.files.length} staged public files match the manifest`,
  );
};

if (process.argv.includes("--check")) {
  check_public_content();
} else {
  sync_public_content();
}
