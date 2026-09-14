const base_path = import.meta.env.BASE_URL.replace(/\/+$/, "");

const with_base = (path_value = "") => {
  const normalized_path = String(path_value).replace(/^\/+/, "");

  if (!normalized_path) {
    return `${base_path}/`;
  }

  return `${base_path}/${normalized_path}`;
};

const content_link_attrs = (href) => {
  return {
    href,
    hx_get: href,
    hx_target: "#sol_page_shell",
    hx_select: "#sol_page_shell",
    hx_swap: "morph swap:220ms settle:260ms",
  };
};

// Single source for the root crumb label. Change it here and every breadcrumb
// trail follows — both the page-driven trails (build_crumbs) and the
// component's URL-derived fallback import this; no second copy to keep in sync.
const HOME_CRUMB_LABEL = "hearth";

// Build a breadcrumb trail with the home crumb already in front. Pages declare
// only their own segments; home lives in one place.
//
//   build_crumbs([
//     { label: "citrinitas", href: with_base("/citrinitas") },
//     { label: book_title, href: null },   // current page: href null
//   ])
//
// Trailing href:null marks the current page (the breadcrumb component lights
// the last crumb by position, so the leaf needs no href).
const build_crumbs = (trail = []) => [
  { label: HOME_CRUMB_LABEL, href: with_base("/") },
  ...trail,
];

export {
  base_path,
  build_crumbs,
  content_link_attrs,
  HOME_CRUMB_LABEL,
  with_base,
};
