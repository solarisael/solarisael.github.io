import { register_node_disposal } from "./node_disposal_bridge.js";
import { fetch_index } from "./search/index.js";
import {
  normalize_text,
  query_terms,
  score_entry,
  search_entries,
} from "./search/ranking.js";

const SEARCH_ROOT_SELECTOR = "[data-search]";
const SEARCH_BOUND_PROPERTY = "__solarisael_search_bound";
let lifecycle_installed = false;

const get_query = () =>
  new URL(window.location.href).searchParams.get("q")?.trim() ?? "";

const create_text = (tag_name, text, class_name = "") => {
  const element = document.createElement(tag_name);
  if (class_name) element.className = class_name;
  element.textContent = text;
  return element;
};

const create_snippet = (entry, query) => {
  const source = entry.text || entry.description;
  if (!source) return "";

  const terms = query_terms(query);
  const normalized_source = normalize_text(source);
  const match_index = terms.reduce((best, term) => {
    const index = normalized_source.indexOf(term);
    return index >= 0 && (best < 0 || index < best) ? index : best;
  }, -1);
  const start = match_index > 80 ? match_index - 80 : 0;
  const end = Math.min(source.length, start + 220);
  return `${start > 0 ? "…" : ""}${source.slice(start, end)}${end < source.length ? "…" : ""}`;
};

const set_status = (root, message) => {
  const status = root.querySelector("[data-search-status]");
  if (status) status.textContent = message;
};

const set_error = (root, visible) => {
  const error = root.querySelector("[data-search-error]");
  if (error) error.hidden = !visible;
};

const render_results = (root, entries, query) => {
  const results = root.querySelector("[data-search-results]");
  if (!results) return;
  results.replaceChildren();

  const matches = search_entries(entries, query);
  set_status(
    root,
    `${matches.length} result${matches.length === 1 ? "" : "s"} for “${query}”.`,
  );

  for (const entry of matches) {
    const item = document.createElement("li");
    item.className = "sol__search_result";

    const heading = document.createElement("h2");
    const link = document.createElement("a");
    link.href = entry.path;
    link.setAttribute("hx-get", entry.path);
    link.setAttribute("hx-target", "#sol_page_shell");
    link.setAttribute("hx-select", "#sol_page_shell");
    link.setAttribute("hx-swap", "morph swap:220ms settle:260ms");
    link.textContent = entry.title;
    heading.append(link);
    item.append(heading);

    if (entry.description) {
      item.append(
        create_text("p", entry.description, "sol__search_result_description"),
      );
    }

    const snippet = create_snippet(entry, query);
    if (snippet)
      item.append(create_text("p", snippet, "sol__search_result_snippet"));
    if (entry.section) {
      item.append(
        create_text("p", entry.section, "sol__search_result_section"),
      );
    }
    results.append(item);
  }

  globalThis.htmx?.process?.(results);
};

const clear_results = (root) => {
  root.querySelector("[data-search-results]")?.replaceChildren();
  set_status(root, "Enter a word or phrase to search.");
};

const push_query = (query) => {
  const url = new URL(window.location.href);
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");

  const current_state =
    window.history.state && typeof window.history.state === "object"
      ? window.history.state
      : {};
  window.history.pushState({ ...current_state, htmx: true }, "", url.href);

  try {
    window.sessionStorage.setItem(
      "htmx-current-path-for-history",
      `${url.pathname}${url.search}`,
    );
  } catch {
    // HTMX will use a live history request when session storage is unavailable.
  }
};

const can_render_query = (disposed, generation, current_generation, query) =>
  !disposed && generation === current_generation && get_query() === query;

const render_loaded_query = (root, entries, query) => {
  if (query) render_results(root, entries, query);
  else clear_results(root);
};

const report_query_error = (
  root,
  error,
  disposed,
  generation,
  current_generation,
) => {
  if (
    disposed ||
    generation !== current_generation ||
    error?.name === "AbortError"
  ) {
    return;
  }
  set_status(root, "Search is unavailable until the index loads.");
  set_error(root, true);
};

const initialize_root = (root) => {
  if (!root || root[SEARCH_BOUND_PROPERTY]) return;
  root[SEARCH_BOUND_PROPERTY] = true;

  const form = root.querySelector("[data-search-form]");
  const input = root.querySelector("[data-search-input]");
  const retry = root.querySelector("[data-search-retry]");
  if (!form || !input || !retry) return;

  let disposed = false;
  let index_promise;
  const abort_controller = new AbortController();

  const load_index = () => {
    index_promise ??= fetch_index(abort_controller.signal).catch((error) => {
      index_promise = undefined;
      throw error;
    });
    return index_promise;
  };

  let query_generation = 0;

  const render_query = async (query, force_load = false) => {
    const generation = ++query_generation;
    input.value = query;
    set_error(root, false);
    if (!query && !force_load) {
      clear_results(root);
      return;
    }

    set_status(root, "Loading the public search index…");
    try {
      const entries = await load_index();
      if (can_render_query(disposed, generation, query_generation, query)) {
        render_loaded_query(root, entries, query);
      }
    } catch (error) {
      report_query_error(root, error, disposed, generation, query_generation);
    }
  };

  const handle_submit = (event) => {
    event.preventDefault();
    const query = input.value.trim().replace(/\s+/g, " ");
    push_query(query);
    void render_query(query);
  };

  const handle_pop_state = () => {
    void render_query(get_query());
  };

  const handle_retry = () => {
    void render_query(get_query(), true);
  };

  form.addEventListener("submit", handle_submit);
  retry.addEventListener("click", handle_retry);
  window.addEventListener("popstate", handle_pop_state);

  register_node_disposal(root, () => {
    disposed = true;
    abort_controller.abort();
    form.removeEventListener("submit", handle_submit);
    retry.removeEventListener("click", handle_retry);
    window.removeEventListener("popstate", handle_pop_state);
  });

  const query = get_query() || root.dataset.searchInitialQuery || "";
  if (query) {
    void render_query(query);
  } else {
    const preload_generation = query_generation;
    void load_index().catch((error) => {
      if (
        !disposed &&
        preload_generation === query_generation &&
        !get_query() &&
        error?.name !== "AbortError"
      ) {
        set_status(root, "Search is unavailable until the index loads.");
        set_error(root, true);
      }
    });
  }
};

export const init_search = () => {
  if (typeof document === "undefined") return;
  initialize_root(document.querySelector(SEARCH_ROOT_SELECTOR));
};

if (typeof document !== "undefined" && !lifecycle_installed) {
  lifecycle_installed = true;
  document.addEventListener("DOMContentLoaded", init_search, { once: true });
  document.addEventListener("htmx:afterSwap", init_search);
  document.addEventListener("htmx:afterSettle", init_search);
  document.addEventListener("htmx:historyRestore", init_search);
}

export { normalize_text, score_entry, search_entries };
