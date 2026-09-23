import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import { wgslVitePlugin } from "@vgpu/wgsl/loader-vite";
import { resolve_obsidian_vault_root } from "./src/config/obsidian_vault_root.js";
import { remark_text_effects } from "scripts-of-folly/remark";
import { remark_interactions } from "./scripts/remark_interactions.js";
import { remark_soft_breaks } from "./scripts/remark_soft_breaks.js";
import { remark_wikilinks } from "./scripts/remark_wikilinks.js";
import rehypeRaw from "rehype-raw";
import { rehype_base_path } from "./scripts/rehype_base_path.js";
import {
  invalidate_wikilink_registry,
  is_wikilink_registry_source,
} from "./src/utils/wikilink_registry.js";

// Both Astro content loaders and Vite's @vault alias resolve through the same
// configured root. Set SOLARISAEL_OBSIDIAN_ROOT for an external Obsidian vault;
// otherwise local/CI builds use the checked-in content directory unless the
// conventional Windows vault exists.
const OBSIDIAN_VAULT_ROOT = resolve_obsidian_vault_root();

// Deploy target — defaults to the root host (GitHub Pages project renamed to
// solarisael.github.io). For subpath hosts, override via env:
//   SOLARISAEL_SITE=https://<name>.example SOLARISAEL_BASE=/solarisael astro build
// Keep SITE and BASE in sync per target.
const SITE = process.env.SOLARISAEL_SITE ?? "https://solarisael.github.io";
const BASE = process.env.SOLARISAEL_BASE ?? "/";

const normalize_path = (path_value = "") =>
  String(path_value).replaceAll("\\", "/");

const obsidian_rubedo_hot_reload = () => {
  const vault_root = normalize_path(OBSIDIAN_VAULT_ROOT).replace(/\/+$/, "");
  const rubedo_root = `${vault_root}/alchemy_writing/zzzz_rubedo/`;
  const rubedo_root_match = rubedo_root.toLowerCase();
  const rubedo_watch_root = `${vault_root}/alchemy_writing/zzzz_rubedo`;

  const is_rendered_rubedo_scene = (file = "") => {
    const changed_file = normalize_path(file).toLowerCase();

    return (
      changed_file.startsWith(rubedo_root_match) &&
      !changed_file.includes("/refs/")
    );
  };

  const reload_rubedo_modules = (server, timestamp = Date.now()) => {
    const invalidated_modules = new Set();

    for (const module_node of server.moduleGraph.idToModuleMap.values()) {
      const module_id = normalize_path(module_node.id ?? "");

      if (
        module_id.includes("/src/data/rubedo/book_timeline_runtime.js") ||
        module_id.includes("/src/pages/rubedo/")
      ) {
        server.moduleGraph.invalidateModule(
          module_node,
          invalidated_modules,
          timestamp,
          true,
        );
      }
    }

    server.ws.send({ type: "full-reload" });
  };

  return {
    name: "solarisael-obsidian-rubedo-hot-reload",
    apply: "serve",
    configureServer(server) {
      server.watcher.add(rubedo_watch_root);
      server.watcher.add(vault_root);
      if (typeof server.watcher.on === "function") {
        const handle_vault_event = (file) => {
          if (is_wikilink_registry_source(file)) {
            invalidate_wikilink_registry();
          }
          if (is_rendered_rubedo_scene(file)) {
            reload_rubedo_modules(server);
          }
        };

        for (const event_name of ["add", "change", "unlink"]) {
          server.watcher.on(event_name, handle_vault_event);
        }
      }
    },
    handleHotUpdate({ file, server, timestamp }) {
      if (is_wikilink_registry_source(file)) {
        invalidate_wikilink_registry();
      }
      if (!is_rendered_rubedo_scene(file)) {
        return;
      }

      reload_rubedo_modules(server, timestamp);
      return [];
    },
    api: {
      is_rendered_rubedo_scene,
    },
  };
};

export { OBSIDIAN_VAULT_ROOT, obsidian_rubedo_hot_reload };

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: [],
  markdown: {
    processor: unified({
      // Wikilinks run before text effects and interactions so links inside
      // marker bodies resolve before those walkers wrap the text nodes.
      // The marker syntaxes differ, so the final two remark plugins are
      // independent. Keep this order: wikilinks → text effects →
      // interactions → soft breaks.
      remarkPlugins: [
        remark_wikilinks,
        remark_text_effects,
        remark_interactions,
        remark_soft_breaks,
      ],
      // Parse raw HTML before base-path rewriting. Vault-authored links and
      // media then become elements whose site-root URLs can be rewritten.
      rehypePlugins: [rehypeRaw, [rehype_base_path, BASE]],
    }),
  },
  vite: {
    plugins: [wgslVitePlugin(), obsidian_rubedo_hot_reload()],
    // Keep linked Folly shaders live instead of freezing them in Vite's dependency cache.
    optimizeDeps: {
      exclude: ["scripts-of-folly/gpu"],
    },
    // Allow Vite to read files from the obsidian vault. Required for dev
    // mode; the build pass resolves globs ahead-of-time so this is
    // belt-and-suspender there. `..` includes the conventional escape;
    // the explicit vault path is what authorizes outside-workspace reads.
    server: {
      fs: {
        allow: ["..", OBSIDIAN_VAULT_ROOT],
      },
    },
    // `@vault` resolves to the obsidian vault root. Used by
    // src/data/rubedo/book_timeline_runtime.js's `import.meta.glob` so
    // rubedo book scenes can be authored in obsidian/alchemy_writing/zzzz_rubedo/
    // alongside the rest of the alchemical content. Vite's glob analyzer
    // expands aliases at build time — keep the alias literal at callsite.
    resolve: {
      alias: {
        "@vault": OBSIDIAN_VAULT_ROOT,
      },
    },
  },
});
