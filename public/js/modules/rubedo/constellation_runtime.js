import { create_constellation_renderer } from "./constellation_renderers.js";
import { bind_constellation_input_controller } from "./constellation_input_controller.js";
import { build_constellation_payload_from_json } from "./constellation_payload.js";
import {
  claim_constellation,
  retire_disconnected_constellations,
} from "./constellation_lifetime.js";
import {
  create_storage_key,
  create_view_state,
  get_store,
} from "./constellation_viewport.js";

const timeline_cache = {};
const timeline_failure_selector = "[data-rubedo-timeline-error]";
const timeline_retry_selector = "[data-rubedo-timeline-retry]";
const timeline_retry_handler = Symbol("timelineRetryHandler");

const is_aborted_error = (error_value, signal) =>
  signal?.aborted || error_value?.name === "AbortError";

const fetch_timeline_book_data = async (book_slug, data_href, signal) => {
  if (timeline_cache[book_slug]) {
    return timeline_cache[book_slug];
  }

  try {
    const response = await fetch(data_href, { signal });

    if (!response.ok) {
      console.warn(
        `[sol__rubedo_constellation] Failed to fetch ${data_href}: ${response.status}`,
      );

      return null;
    }

    const book_data = await response.json();
    signal?.throwIfAborted();
    timeline_cache[book_slug] = book_data;

    return timeline_cache[book_slug];
  } catch (fetch_error) {
    if (is_aborted_error(fetch_error, signal)) {
      return null;
    }
    console.warn(
      `[sol__rubedo_constellation] Fetch error for ${data_href}:`,
      fetch_error,
    );

    return null;
  }
};

const base_path_from_data_href = (data_href) => {
  return data_href.replace(/\/rubedo\/data\/[^/]+\.json$/, "");
};

const clear_timeline_failure = (interactive_section) => {
  const failure_node = interactive_section.querySelector(
    timeline_failure_selector,
  );

  if (failure_node instanceof HTMLElement) {
    failure_node.hidden = true;
  }
};

const timeline_failure_nodes = (interactive_section) => ({
  failure_node: interactive_section.querySelector(timeline_failure_selector),
  retry_node: interactive_section.querySelector(timeline_retry_selector),
});

const retry_timeline = async (interactive_section) => {
  if (
    !interactive_section.isConnected ||
    interactive_section.dataset.timelineRetrying
  ) {
    return;
  }

  interactive_section.dataset.timelineRetrying = "true";
  clear_timeline_failure(interactive_section);
  delete timeline_cache[interactive_section.dataset.bookSlug ?? ""];

  try {
    await init_constellation(interactive_section);
  } finally {
    delete interactive_section.dataset.timelineRetrying;
  }
};

const show_timeline_failure = (interactive_section) => {
  const { failure_node, retry_node } =
    timeline_failure_nodes(interactive_section);

  if (!(failure_node instanceof HTMLElement)) {
    return;
  }

  failure_node.hidden = false;

  if (
    retry_node instanceof HTMLButtonElement &&
    !interactive_section[timeline_retry_handler]
  ) {
    retry_node.addEventListener("click", () =>
      retry_timeline(interactive_section),
    );
    interactive_section[timeline_retry_handler] = true;
  }
};

const bind_constellation = async (interactive_section, binding) => {
  const book_slug = interactive_section.dataset.bookSlug ?? "";
  const data_href = interactive_section.dataset.timelineDataHref ?? "";

  if (!book_slug || !data_href) {
    return null;
  }

  const book_data = await fetch_timeline_book_data(
    book_slug,
    data_href,
    binding.signal,
  );

  if (!book_data || !binding.is_active()) {
    return null;
  }

  const base_path = base_path_from_data_href(data_href);
  const payload = build_constellation_payload_from_json(
    book_data,
    base_path,
    null,
  );
  const root_node = interactive_section;
  const canvas = root_node.querySelector("#sol_rubedo_timeline_canvas");

  if (!(canvas instanceof HTMLCanvasElement)) {
    return null;
  }

  const store = get_store();
  const storage_key = create_storage_key(root_node);
  const view_state = {
    ...create_view_state(payload),
    ...(store[storage_key] || {}),
  };
  const renderer = create_constellation_renderer(canvas, payload, view_state);

  if (!renderer) {
    return null;
  }

  binding.set_renderer(renderer);
  return await bind_constellation_input_controller({
    root_node,
    canvas,
    payload,
    renderer,
    view_state,
    store,
    storage_key,
    book_data,
    book_slug,
    base_path,
    signal: binding.signal,
  });
};

const init_constellation = async (interactive_section) => {
  const binding = claim_constellation(interactive_section);
  if (!binding) {
    return;
  }

  clear_timeline_failure(interactive_section);
  let disposer = null;
  try {
    disposer = await bind_constellation(interactive_section, binding);
    if (!disposer && binding.is_active()) {
      show_timeline_failure(interactive_section);
    }
  } catch (error) {
    if (!is_aborted_error(error, binding.signal) && binding.is_active()) {
      console.warn(
        "[sol__rubedo_constellation] Timeline initialization failed:",
        error,
      );
      show_timeline_failure(interactive_section);
    }
  } finally {
    if (!disposer) {
      binding.dispose();
    }
  }
};

const init_rubedo_constellation = () => {
  if (typeof document === "undefined") {
    return;
  }
  retire_disconnected_constellations();

  const interactive_sections = document.querySelectorAll(
    "#sol_rubedo_timeline_interactive[data-timeline-data-href]",
  );

  interactive_sections.forEach((section) => {
    init_constellation(section);
  });
};

export {
  base_path_from_data_href,
  clear_timeline_failure,
  fetch_timeline_book_data,
  init_constellation,
  init_rubedo_constellation,
  show_timeline_failure,
  timeline_cache,
};
