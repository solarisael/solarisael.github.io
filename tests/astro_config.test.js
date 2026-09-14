import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";

const original_obsidian_root = process.env.SOLARISAEL_OBSIDIAN_ROOT;
let config_import_counter = 0;
let temporary_vault_root = null;

const restore_obsidian_root = () => {
  if (original_obsidian_root === undefined) {
    delete process.env.SOLARISAEL_OBSIDIAN_ROOT;
    return;
  }

  process.env.SOLARISAEL_OBSIDIAN_ROOT = original_obsidian_root;
};

const import_config_with_vault_root = async (vault_root) => {
  process.env.SOLARISAEL_OBSIDIAN_ROOT = vault_root;
  config_import_counter += 1;

  return import(
    `../astro.config.mjs?rubedo_hot_reload_test=${config_import_counter}`
  );
};

afterEach(() => {
  restore_obsidian_root();
  if (temporary_vault_root) {
    rmSync(temporary_vault_root, { recursive: true, force: true });
    temporary_vault_root = null;
  }
});

const create_vite_server_fake = () => {
  const watched_roots = [];
  const invalidated_modules = [];
  const websocket_messages = [];

  const server = {
    watcher: {
      add(path) {
        watched_roots.push(path);
      },
    },
    moduleGraph: {
      idToModuleMap: new Map([
        [
          "timeline",
          {
            id: "C:/Projects/solarisael/src/data/rubedo/book_timeline_runtime.js",
          },
        ],
        [
          "rubedo_page",
          { id: "C:/Projects/solarisael/src/pages/rubedo/index.astro" },
        ],
        [
          "other_page",
          { id: "C:/Projects/solarisael/src/pages/nigredo/index.astro" },
        ],
      ]),
      invalidateModule(module_node, invalidated_module_set, timestamp, hard) {
        invalidated_module_set.add(module_node);
        invalidated_modules.push({ id: module_node.id, timestamp, hard });
      },
    },
    ws: {
      send(message) {
        websocket_messages.push(message);
      },
    },
  };

  return { server, watched_roots, invalidated_modules, websocket_messages };
};

describe("obsidian_rubedo_hot_reload", () => {
  test("reloads configured rubedo scene paths while ignoring refs and other vault files", async () => {
    temporary_vault_root = mkdtempSync(
      path.join(tmpdir(), "solarisael-vault-"),
    );
    const vault_root = temporary_vault_root.replaceAll("\\", "/");
    const { obsidian_rubedo_hot_reload } =
      await import_config_with_vault_root(vault_root);
    const plugin = obsidian_rubedo_hot_reload();
    const { server, watched_roots, invalidated_modules, websocket_messages } =
      create_vite_server_fake();

    plugin.configureServer(server);

    expect(watched_roots).toEqual([
      `${vault_root}/alchemy_writing/zzzz_rubedo`,
      vault_root,
    ]);

    const ignored_non_rubedo_result = plugin.handleHotUpdate({
      file: `${vault_root}/nigredo/scene.md`,
      server,
      timestamp: 100,
    });
    const ignored_refs_result = plugin.handleHotUpdate({
      file: `${vault_root}/alchemy_writing/zzzz_rubedo/refs/note.md`,
      server,
      timestamp: 101,
    });

    expect(ignored_non_rubedo_result).toBeUndefined();
    expect(ignored_refs_result).toBeUndefined();
    expect(invalidated_modules).toEqual([]);
    expect(websocket_messages).toEqual([]);

    const hot_update_result = plugin.handleHotUpdate({
      file: `${vault_root.replaceAll("/", "\\")}\\alchemy_writing\\zzzz_rubedo\\chapter-001.md`,
      server,
      timestamp: 102,
    });

    expect(hot_update_result).toEqual([]);
    expect(invalidated_modules).toEqual([
      {
        id: "C:/Projects/solarisael/src/data/rubedo/book_timeline_runtime.js",
        timestamp: 102,
        hard: true,
      },
      {
        id: "C:/Projects/solarisael/src/pages/rubedo/index.astro",
        timestamp: 102,
        hard: true,
      },
    ]);
    expect(websocket_messages).toEqual([{ type: "full-reload" }]);
  });

  test("uses the configured root for the Vite alias and exported config root", async () => {
    temporary_vault_root = mkdtempSync(
      path.join(tmpdir(), "solarisael-vault-"),
    );
    const vault_root = temporary_vault_root.replaceAll("\\", "/");
    const { OBSIDIAN_VAULT_ROOT, default: astro_config } =
      await import_config_with_vault_root(vault_root);

    expect(OBSIDIAN_VAULT_ROOT).toBe(vault_root.replaceAll("/", path.sep));
    expect(astro_config.vite.resolve.alias["@vault"]).toBe(
      vault_root.replaceAll("/", path.sep),
    );
  });
});
