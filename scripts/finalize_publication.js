import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Window } from "happy-dom";

const dist = path.join(process.cwd(), "dist");
const site_origin = new URL(
  process.env.SOLARISAEL_SITE ?? "https://solarisael.github.io",
);
const base = (process.env.SOLARISAEL_BASE ?? "/").replace(/\/$/u, "");
const is_search_url = (value) => {
  const pathname = new URL(value, site_origin).pathname.replace(/\/+$/u, "");
  return (
    pathname === `${base}/search` || (base === "" && pathname === "/search")
  );
};

const walk = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const full_path = path.join(directory, item.name);
    return item.isDirectory() ? walk(full_path) : [full_path];
  });

const rendered_document = (html) => {
  const window = new Window({
    settings: {
      disableJavaScriptEvaluation: true,
      enableJavaScriptEvaluation: false,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      enableImageFileLoading: false,
      disableIframePageLoading: true,
    },
  });
  window.document.write(html);
  window.document.close();
  return window;
};

const rendered_text = (window) => {
  const vessel = window.document.querySelector("#sol_content");
  if (!vessel) return "";
  for (const element of vessel.querySelectorAll(
    "script,style,noscript,[hidden],[aria-hidden='true']",
  )) {
    element.remove();
  }
  for (const element of vessel.querySelectorAll(
    "br,p,li,h1,h2,h3,h4,h5,h6,pre,blockquote,section,article,header,footer,td,th,tr",
  )) {
    if (element.localName === "br") {
      element.replaceWith(window.document.createTextNode(" "));
    } else {
      element.append(window.document.createTextNode(" "));
    }
  }
  return vessel.textContent.replace(/\s+/gu, " ").trim();
};

if (!existsSync(dist)) {
  console.error("publication finalizer requires a completed dist directory");
  process.exitCode = 1;
} else {
  const index_path = path.join(dist, "search-index.json");
  if (!existsSync(index_path)) {
    console.error("publication finalizer requires dist/search-index.json");
    process.exitCode = 1;
  } else {
    const rendered_by_url = new Map();
    for (const file of walk(dist).filter((candidate) =>
      candidate.endsWith(".html"),
    )) {
      const window = rendered_document(readFileSync(file, "utf8"));
      const canonical = window.document.querySelector(
        'link[rel="canonical"]',
      )?.href;
      if (canonical) {
        const text = rendered_text(window);
        if (text)
          rendered_by_url.set(new URL(canonical, site_origin).href, text);
      }
      window.close();
    }

    // This post-build boundary replaces catalog fallback prose with the
    // rendered public page, so production search mirrors what readers see.
    const source_index = JSON.parse(readFileSync(index_path, "utf8"));
    const index = source_index.filter((item) => !is_search_url(item.path));
    let replaced = 0;
    for (const item of index) {
      const url = new URL(item.path, site_origin).href;
      item.text = rendered_by_url.get(url) ?? "";
      if (item.text) replaced += 1;
    }
    writeFileSync(index_path, `${JSON.stringify(index)}\n`);
    console.log(
      `publication finalizer replaced ${replaced} search records with rendered page content.`,
    );
  }
}
