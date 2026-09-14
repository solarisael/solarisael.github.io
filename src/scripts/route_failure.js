import {
  is_preload_request,
  is_route_swap_target,
} from "../../public/js/modules/htmx_route_lifecycle.js";

const route_failure_selector = "[data-route-failure]";
const route_failure_message_selector = "[data-route-failure-message]";
const route_failure_retry_selector = "[data-route-failure-retry]";

const request_detail = (event) => event?.detail ?? {};

const is_route_request = (event) => {
  const detail = request_detail(event);

  if (is_preload_request(event)) {
    return false;
  }

  if (is_route_swap_target(detail.target)) {
    return true;
  }

  const configured_target = detail.requestConfig?.target;
  return (
    typeof configured_target === "string" &&
    configured_target.split(/\s+/).includes("#sol_page_shell")
  );
};

const request_method = (detail) => {
  const method = detail.requestConfig?.verb ?? detail.requestConfig?.method;
  if (typeof method === "string") {
    return method.toUpperCase();
  }

  return detail.elt instanceof HTMLAnchorElement ? "GET" : null;
};

const request_href = (detail) => {
  const raw_path =
    detail.pathInfo?.finalRequestPath ??
    detail.requestConfig?.path ??
    detail.path ??
    (detail.elt instanceof HTMLAnchorElement ? detail.elt.href : null);

  if (typeof raw_path !== "string" || request_method(detail) !== "GET") {
    return null;
  }

  try {
    const request_url = new URL(raw_path, window.location.href);

    if (
      request_url.origin !== window.location.origin ||
      request_url.protocol !== window.location.protocol ||
      request_url.username ||
      request_url.password
    ) {
      return null;
    }

    return request_url.href;
  } catch {
    return null;
  }
};

const set_failure_message = (root_node, event_name) => {
  const message_node = root_node.querySelector(route_failure_message_selector);

  if (!(message_node instanceof HTMLElement)) {
    return;
  }

  message_node.textContent =
    event_name === "htmx:timeout"
      ? "This page took too long to load. Check your connection and try again."
      : "This page could not be loaded. Check your connection and try again.";
};

const clear_route_failure = (root_node) => {
  root_node.hidden = true;
  root_node.removeAttribute("data-route-failure-kind");
};

const show_route_failure = (root_node, event) => {
  const detail = request_detail(event);
  const retry_href = request_href(detail);
  const retry_node = root_node.querySelector(route_failure_retry_selector);

  set_failure_message(root_node, event.type);
  root_node.dataset.routeFailureKind = event.type;
  root_node.hidden = false;

  if (retry_node instanceof HTMLButtonElement) {
    retry_node.hidden = retry_href === null;
    retry_node.onclick = retry_href
      ? () => {
          const validated_href = request_href({
            requestConfig: { verb: "GET", path: retry_href },
          });
          if (validated_href) {
            window.location.assign(validated_href);
          }
        }
      : null;
  }
};

const create_route_failure_state = (root_node) => ({
  root_node,
  active_xhr: null,
  aborted_xhrs: new WeakSet(),
  superseded_xhrs: new WeakSet(),
});

const start_route_request = (state, event) => {
  const detail = request_detail(event);
  if (state.active_xhr && state.active_xhr !== detail.xhr) {
    state.superseded_xhrs.add(state.active_xhr);
  }
  state.active_xhr = detail.xhr ?? null;
  clear_route_failure(state.root_node);
};

const handle_route_before_request = (state, event) => {
  if (!is_route_request(event)) {
    return;
  }

  start_route_request(state, event);
};

const handle_route_abort = (state, event) => {
  const xhr = request_detail(event).xhr;
  if (!xhr || xhr !== state.active_xhr) {
    return;
  }

  state.aborted_xhrs.add(xhr);
  state.active_xhr = null;
  clear_route_failure(state.root_node);
};

const handle_route_after_request = (state, event) => {
  if (!is_route_request(event)) {
    return;
  }

  const detail = request_detail(event);
  if (detail.xhr && detail.xhr === state.active_xhr && detail.successful) {
    state.active_xhr = null;
    clear_route_failure(state.root_node);
  }
};

const is_ignored_route_error = (state, event) => {
  if (!is_route_request(event)) {
    return true;
  }

  const xhr = request_detail(event).xhr;
  if (xhr && (state.aborted_xhrs.has(xhr) || state.superseded_xhrs.has(xhr))) {
    return true;
  }

  return Boolean(xhr && state.active_xhr && xhr !== state.active_xhr);
};

const handle_route_error = (state, event) => {
  if (is_ignored_route_error(state, event)) {
    return;
  }

  show_route_failure(state.root_node, event);
};

const handle_route_after_settle = (state, event) => {
  if (!is_route_swap_target(request_detail(event).target)) {
    return;
  }

  state.active_xhr = null;
  clear_route_failure(state.root_node);
};

const bind_route_failure_events = (body_node, state) => {
  body_node.addEventListener("htmx:beforeRequest", (event) =>
    handle_route_before_request(state, event),
  );
  body_node.addEventListener("htmx:abort", (event) =>
    handle_route_abort(state, event),
  );
  body_node.addEventListener("htmx:afterRequest", (event) =>
    handle_route_after_request(state, event),
  );

  for (const event_name of [
    "htmx:responseError",
    "htmx:sendError",
    "htmx:timeout",
  ]) {
    body_node.addEventListener(event_name, (event) =>
      handle_route_error(state, event),
    );
  }

  body_node.addEventListener("htmx:afterSettle", (event) =>
    handle_route_after_settle(state, event),
  );
  body_node.addEventListener("htmx:historyRestore", () => {
    state.active_xhr = null;
    clear_route_failure(state.root_node);
  });
};

const install_route_failure = (document_node = globalThis.document) => {
  if (
    !document_node ||
    globalThis.__solarisael_route_failure_installed ||
    !(document_node.body instanceof HTMLElement)
  ) {
    return false;
  }

  const root_node = document_node.querySelector(route_failure_selector);
  if (!(root_node instanceof HTMLElement)) {
    return false;
  }

  bind_route_failure_events(
    document_node.body,
    create_route_failure_state(root_node),
  );
  globalThis.__solarisael_route_failure_installed = true;
  return true;
};

export { install_route_failure, is_route_request, request_href };
