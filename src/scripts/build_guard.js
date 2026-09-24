import { is_route_swap_target } from "../../public/js/modules/htmx_route_lifecycle.js";

// htmx swaps only #sol_page_shell and never replaces <head>. After a deploy,
// an open tab keeps the old head (old hashed bundles) while the next swap
// brings a shell from the new build. This guard refuses that swap and loads
// the whole page instead, so head and shell always come from one build.
// The decision is modelled and proven in laws/build_guard/.

const head_build_selector = 'meta[name="sol-build"]';

// enough: reads the attribute from the literal opening tag of the shell, with
// double quotes, as src/layouts/index.astro renders it. A shell rendered any
// other way reads as untagged and swaps. Use DOMParser if the markup changes.
const shell_build_pattern =
  /<main\b[^>]*?\bid="sol_page_shell"[^>]*?\bdata-sol-build="([^"]*)"/u;

// Mirrors `decide` in laws/build_guard/build_guard.bend: true is Reload{},
// false is Swap{}. A missing id on either side swaps.
const should_reload = (head_id, incoming_id) => {
  if (!head_id || !incoming_id) {
    return false;
  }

  return head_id !== incoming_id;
};

const read_head_build = (document_node) =>
  document_node.querySelector(head_build_selector)?.content ?? "";

const read_incoming_build = (response_text) => {
  if (typeof response_text !== "string") {
    return "";
  }

  return shell_build_pattern.exec(response_text)?.[1] ?? "";
};

const reload_path = (detail) =>
  detail.pathInfo?.finalRequestPath || detail.pathInfo?.requestPath;

const create_build_guard_state = () => ({ warned: false });

const handle_before_swap = (state, document_node, event) => {
  const detail = event?.detail;
  // An error response the swap already refused needs no second opinion.
  if (!detail?.shouldSwap || !is_route_swap_target(detail.target)) {
    return;
  }

  const head_id = read_head_build(document_node);
  const incoming_id = read_incoming_build(detail.xhr?.responseText);
  if (!should_reload(head_id, incoming_id)) {
    return;
  }

  const target_path = reload_path(detail);
  if (!target_path) {
    console.warn(
      `[build_guard] head build ${head_id} and shell build ${incoming_id} differ, but the request has no path; swapping.`,
    );
    return;
  }

  detail.shouldSwap = false;
  if (!state.warned) {
    state.warned = true;
    console.warn(
      `[build_guard] head build ${head_id} and shell build ${incoming_id} differ; reloading ${target_path}.`,
    );
  }
  window.location.assign(target_path);
};

const install_build_guard = (document_node = globalThis.document) => {
  if (!document_node || globalThis.__solarisael_build_guard_installed) {
    return false;
  }

  const state = create_build_guard_state();
  document_node.addEventListener("htmx:beforeSwap", (event) => {
    // A broken guard must not break navigation: report it and let htmx swap.
    try {
      handle_before_swap(state, document_node, event);
    } catch (error) {
      console.error("[build_guard] check failed; swap left to htmx.", error);
    }
  });
  globalThis.__solarisael_build_guard_installed = true;
  return true;
};

install_build_guard();

export { install_build_guard, should_reload };
