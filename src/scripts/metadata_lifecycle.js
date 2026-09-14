const metadata_values = [
  [
    "meta[name=description]",
    "content",
    "description",
    "data-sol-page-description",
  ],
  ["meta[name=robots]", "content", "robots", "data-sol-robots"],
  ["meta[property='og:title']", "content", "title", "data-sol-page-title"],
  [
    "meta[property='og:description']",
    "content",
    "description",
    "data-sol-page-description",
  ],
  ["meta[property='og:type']", "content", "og_type", "data-sol-og-type"],
  [
    "meta[property='og:url']",
    "content",
    "canonical_url",
    "data-sol-canonical-url",
  ],
  [
    "meta[property='og:site_name']",
    "content",
    "og_site_name",
    "data-sol-og-site-name",
  ],
  [
    "meta[property='og:image']",
    "content",
    "social_image",
    "data-sol-social-image",
  ],
  [
    "meta[property='og:image:width']",
    "content",
    "social_image_width",
    "data-sol-social-image-width",
  ],
  [
    "meta[property='og:image:height']",
    "content",
    "social_image_height",
    "data-sol-social-image-height",
  ],
  [
    "meta[property='og:image:alt']",
    "content",
    "social_image_alt",
    "data-sol-social-image-alt",
  ],
  ["meta[name='twitter:title']", "content", "title", "data-sol-page-title"],
  [
    "meta[name='twitter:description']",
    "content",
    "description",
    "data-sol-page-description",
  ],
  [
    "meta[name='twitter:image']",
    "content",
    "social_image",
    "data-sol-social-image",
  ],
  [
    "meta[name='twitter:image:alt']",
    "content",
    "social_image_alt",
    "data-sol-social-image-alt",
  ],
  ["link[rel=canonical]", "href", "canonical_url", "data-sol-canonical-url"],
  [
    "link[rel=alternate][type='application/rss+xml']",
    "href",
    "rss_href",
    "data-sol-rss-href",
  ],
  ["link[rel=describedby]", "href", "llms_href", "data-sol-llms-href"],
];

const trusted_origins = new Set([window.location.origin]);
try {
  const initial_canonical = document.head.querySelector(
    "link[rel=canonical]",
  )?.href;
  if (initial_canonical) trusted_origins.add(new URL(initial_canonical).origin);
} catch {
  // A malformed initial canonical remains untouched until a trusted payload arrives.
}

const trusted_url = (value) => {
  try {
    const url = new URL(value, window.location.href);
    return trusted_origins.has(url.origin) ? url : null;
  } catch {
    return null;
  }
};

const read_payload = (shell) => {
  const payload_node = shell.querySelector("#sol_page_metadata");
  const payload_text = payload_node?.textContent?.trim();
  if (!payload_text) return null;
  try {
    return JSON.parse(payload_text);
  } catch {
    return null;
  }
};

const read_metadata_value = (payload, shell, payload_key, fallback_attribute) =>
  payload[payload_key] ?? shell.getAttribute(fallback_attribute);

const apply_metadata_value = (
  shell,
  payload,
  [selector, attribute, payload_key, fallback_attribute],
) => {
  const target = document.head.querySelector(selector);
  const value = read_metadata_value(
    payload,
    shell,
    payload_key,
    fallback_attribute,
  );
  if (!target || !value) return;
  if (attribute === "href" && !trusted_url(value)) return;
  target.setAttribute(attribute, value);
};

const update_metadata = () => {
  const shell = document.querySelector("#sol_page_shell");
  if (!shell) return;
  const payload = read_payload(shell) ?? {};
  const page_title = payload.title ?? shell.dataset.solPageTitle;
  if (page_title?.trim()) document.title = page_title.trim();
  for (const metadata_value of metadata_values) {
    apply_metadata_value(shell, payload, metadata_value);
  }
};

const schedule_metadata_update = () => {
  update_metadata();
  queueMicrotask(update_metadata);
};

const install_metadata_lifecycle = () => {
  if (window.__solarisael_metadata_lifecycle) return;
  window.__solarisael_metadata_lifecycle = true;
  document.addEventListener("htmx:afterSwap", schedule_metadata_update);
  document.addEventListener("htmx:historyRestore", schedule_metadata_update);
};

install_metadata_lifecycle();

export { install_metadata_lifecycle, update_metadata };
