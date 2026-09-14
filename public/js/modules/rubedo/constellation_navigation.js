const navigation_options = (link) => ({
  target: link.hx_target || "#sol_page_shell",
  select: link.hx_select || "#sol_page_shell",
  swap: link.hx_swap || "morph swap:220ms settle:260ms",
  pushURL: String(link.hx_push_url) === "true",
});

const navigate_document = (link) => {
  if (link.href) {
    window.location.href = link.href;
  }
};

const dispatch_map_navigation = (node_entry) => {
  if (!node_entry?.link) {
    return;
  }

  const window_any = /** @type {any} */ (globalThis);
  const htmx_api = window_any.htmx;

  if (htmx_api?.ajax) {
    htmx_api.ajax(
      "GET",
      node_entry.link.hx_get || node_entry.link.href,
      navigation_options(node_entry.link),
    );

    return;
  }

  navigate_document(node_entry.link);
};

export { dispatch_map_navigation };
