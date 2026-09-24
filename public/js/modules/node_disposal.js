/**
 * HTMX-aware cleanup registry for feature-owned DOM roots.
 *
 * HTMX's ordinary cleanup event fires before the node is detached. Idiomorph
 * removes unmatched nodes without that event, so the afterSwap sweep is the
 * second half of this seam: it only retires roots that are no longer connected.
 *
 * The registry lives on globalThis, not in module scope: this file is served
 * from /js/modules/ and may also be inlined by a bundler, and every instance
 * must feed the one registry the HTMX listeners sweep.
 */

const NODE_DISPOSAL_API_SYMBOL = Symbol.for("solarisael.node_disposal");
const NODE_DISPOSAL_REGISTRY_SYMBOL = Symbol.for(
  "solarisael.node_disposal.registry",
);

globalThis[NODE_DISPOSAL_REGISTRY_SYMBOL] ??= Object.freeze({
  registered_disposals: new Map(),
  installed_documents: new WeakSet(),
});

const { registered_disposals, installed_documents } =
  globalThis[NODE_DISPOSAL_REGISTRY_SYMBOL];

const is_disposable_root = (root_node) => {
  const element_constructor = globalThis.Element;

  return (
    typeof element_constructor === "function" &&
    root_node instanceof element_constructor
  );
};

const report_disposal_error = (error_value) => {
  if (typeof globalThis.console?.error !== "function") {
    return;
  }

  globalThis.console.error("Node disposal callback failed", error_value);
};

const run_registered_disposals = (root_node) => {
  const cleanup_callbacks = registered_disposals.get(root_node);

  if (!cleanup_callbacks) {
    return false;
  }

  registered_disposals.delete(root_node);
  const callback_list = Array.from(cleanup_callbacks);
  cleanup_callbacks.clear();

  for (const cleanup_callback of callback_list) {
    try {
      cleanup_callback(root_node);
    } catch (error_value) {
      report_disposal_error(error_value);
    }
  }

  return true;
};

const dispose_registered_subtree = (cleanup_root) => {
  if (!is_disposable_root(cleanup_root)) {
    return 0;
  }

  let disposed_count = 0;
  const registered_roots = Array.from(registered_disposals.keys());

  for (const registered_root of registered_roots) {
    if (
      registered_root !== cleanup_root &&
      !cleanup_root.contains(registered_root)
    ) {
      continue;
    }

    if (run_registered_disposals(registered_root)) {
      disposed_count += 1;
    }
  }

  return disposed_count;
};

const sweep_disconnected_roots = () => {
  let disposed_count = 0;

  for (const registered_root of Array.from(registered_disposals.keys())) {
    if (registered_root.isConnected) {
      continue;
    }

    if (run_registered_disposals(registered_root)) {
      disposed_count += 1;
    }
  }

  return disposed_count;
};

/**
 * Register one cleanup callback for a feature-owned DOM root.
 *
 * @param {Element} root_node
 * @param {(root_node: Element) => void} cleanup_callback
 * @returns {() => void} unregister function
 */
export const register_node_disposal = (root_node, cleanup_callback) => {
  if (
    !is_disposable_root(root_node) ||
    typeof cleanup_callback !== "function"
  ) {
    return () => {};
  }

  let cleanup_callbacks = registered_disposals.get(root_node);

  if (!cleanup_callbacks) {
    cleanup_callbacks = new Set();
    registered_disposals.set(root_node, cleanup_callbacks);
  }

  cleanup_callbacks.add(cleanup_callback);

  return () => {
    const current_callbacks = registered_disposals.get(root_node);

    if (!current_callbacks) {
      return;
    }

    current_callbacks.delete(cleanup_callback);

    if (!current_callbacks.size) {
      registered_disposals.delete(root_node);
    }
  };
};

/**
 * Dispose a root that has already been detached from the document.
 *
 * Connected roots are intentionally left alone so idiomorph-preserved roots
 * can survive a swap and continue to own their registered resources.
 *
 * @param {Element} root_node
 * @returns {boolean}
 */
export const dispose_removed_root = (root_node) => {
  if (!is_disposable_root(root_node) || root_node.isConnected) {
    return false;
  }

  return run_registered_disposals(root_node);
};

/**
 * Install the document-level HTMX cleanup/swap listeners once.
 *
 * Passing a document is useful for native/test contexts; callers can install
 * the seam even when HTMX itself is not present yet.
 *
 * @param {Document | undefined} document_node
 * @returns {boolean} whether listeners were installed
 */
export const install_node_disposal_lifecycle = (
  document_node = globalThis.document,
) => {
  if (
    !document_node ||
    typeof document_node.addEventListener !== "function" ||
    installed_documents.has(document_node)
  ) {
    return false;
  }

  document_node.addEventListener(
    "htmx:beforeCleanupElement",
    (event) => {
      const htmx_event = /** @type {CustomEvent} */ (event);
      const cleanup_root = htmx_event.detail?.elt ?? htmx_event.target;

      dispose_registered_subtree(cleanup_root);
    },
    true,
  );

  document_node.addEventListener(
    "htmx:afterSwap",
    () => {
      sweep_disconnected_roots();
    },
    true,
  );

  installed_documents.add(document_node);
  return true;
};

const node_disposal_api = Object.freeze({
  dispose_removed_root,
  register_node_disposal,
});

globalThis[NODE_DISPOSAL_API_SYMBOL] = node_disposal_api;

export { NODE_DISPOSAL_API_SYMBOL };
