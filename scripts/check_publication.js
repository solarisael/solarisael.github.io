import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { SaxesParser } from "saxes";

const root = process.cwd();
const dist = path.join(root, "dist");
const site_origin =
  process.env.SOLARISAEL_SITE ?? "https://solarisael.github.io";
const site_origin_url = new URL(site_origin);
const base = (process.env.SOLARISAEL_BASE ?? "/").replace(/\/$/u, "");
const base_segment = base.replace(/^\/+/u, "");
const failures = [];
const fail = (message) => failures.push(message);
const escape_regex = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const parse_xml = (source, filename) => {
  let parser_error = null;
  try {
    const parser = new SaxesParser({ xmlns: false });
    parser.on("error", (error) => {
      parser_error = error;
    });
    parser.write(source).close();
  } catch (error) {
    parser_error = error;
  }
  if (parser_error) {
    fail(`${filename} is malformed XML: ${parser_error.message}`);
    return false;
  }
  return true;
};
const read = (file) => readFileSync(path.join(dist, file), "utf8");
const walk = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const full_path = path.join(directory, item.name);
    return item.isDirectory() ? walk(full_path) : [full_path];
  });
const local_dist_candidates = (value) => {
  let url;
  try {
    url = new URL(value, site_origin_url);
  } catch {
    return null;
  }
  if (url.origin !== site_origin_url.origin) return null;
  const relative = url.pathname
    .replace(/^\//u, "")
    .replace(new RegExp(`^${escape_regex(base_segment)}/?`, "u"), "");
  return [path.join(dist, relative), path.join(dist, relative, "index.html")];
};
const route_path = (url) => {
  const pathname = new URL(url).pathname;
  const prefix = base ? `${base}/` : "/";
  return pathname.startsWith(prefix)
    ? pathname.slice(prefix.length - 1)
    : pathname;
};

if (!existsSync(dist)) {
  fail("dist does not exist; run astro build before site:check");
} else {
  const html_documents = walk(dist)
    .filter((file) => file.endsWith(".html"))
    .map((file) => ({ file, html: readFileSync(file, "utf8") }));
  const canonical_urls = new Set();
  const indexable_urls = new Set();

  for (const { file, html } of html_documents) {
    const relative = path.relative(dist, file).replaceAll(path.sep, "/");
    if (relative === "404.html") continue;
    const canonical = html.match(
      /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/iu,
    )?.[1];
    const title = html.match(/<title>([^<]+)<\/title>/iu)?.[1]?.trim();
    const description = html
      .match(
        /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/iu,
      )?.[1]
      ?.trim();
    const noindex =
      /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/iu.test(
        html,
      );
    if (!title) fail(`${relative}: missing title`);
    if (!description) fail(`${relative}: missing description`);
    if (!canonical) fail(`${relative}: missing canonical URL`);
    for (const required of [
      "og:title",
      "og:description",
      "og:type",
      "og:url",
      "og:site_name",
      "og:image",
    ]) {
      if (
        !new RegExp(
          `<meta\\s+property=["']${escape_regex(required)}["']`,
          "iu",
        ).test(html)
      ) {
        fail(`${relative}: missing ${required}`);
      }
    }
    const og_image = html.match(
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/iu,
    )?.[1];
    const image_paths = og_image ? local_dist_candidates(og_image) : null;
    if (
      !image_paths ||
      !image_paths.some((candidate) => existsSync(candidate))
    ) {
      fail(`${relative}: og:image is not a local generated asset`);
    }
    if (canonical) {
      try {
        const url = new URL(canonical);
        if (url.origin !== site_origin_url.origin)
          fail(`${relative}: canonical origin is ${url.origin}`);
        if (url.search || url.hash)
          fail(`${relative}: canonical contains query or hash`);
        canonical_urls.add(url.href);
        if (!noindex) indexable_urls.add(url.href);
      } catch {
        fail(`${relative}: invalid canonical URL`);
      }
    }
    for (const match of html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/giu)) {
      const resource = match[1];
      if (/^(?:https?:|data:|mailto:|javascript:)/iu.test(resource)) continue;
      const candidates = local_dist_candidates(resource);
      if (
        !candidates ||
        !candidates.some((candidate) => existsSync(candidate))
      ) {
        fail(`${relative}: missing local resource ${resource}`);
      }
    }
  }

  const required_files = [
    "sitemap.xml",
    "robots.txt",
    "llms.txt",
    "rss.xml",
    "search-index.json",
  ];
  for (const file of required_files)
    if (!existsSync(path.join(dist, file))) fail(`missing generated ${file}`);

  if (existsSync(path.join(dist, "sitemap.xml"))) {
    const sitemap = read("sitemap.xml");
    parse_xml(sitemap, "sitemap.xml");
    const sitemap_urls = new Set(
      [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]),
    );
    if (!/<urlset[\s>]/iu.test(sitemap) || !/<\/urlset>/iu.test(sitemap))
      fail("sitemap.xml is not a complete urlset");
    if (indexable_urls.size > 0 && sitemap_urls.size === 0)
      fail("sitemap.xml has no URLs");
    for (const url of sitemap_urls)
      if (!canonical_urls.has(url)) fail(`sitemap URL has no page: ${url}`);
    for (const url of indexable_urls)
      if (!sitemap_urls.has(url))
        fail(`indexable page missing from sitemap: ${url}`);
    if (
      [...sitemap_urls].some(
        (url) =>
          route_path(url) === "/search/" || route_path(url) === "/search",
      )
    )
      fail("sitemap includes the noindex search page");
    if (sitemap.includes("404.html")) fail("sitemap includes the 404 page");
  }

  if (existsSync(path.join(dist, "robots.txt"))) {
    const robots = read("robots.txt");
    if (
      !/^User-agent:\s*\*\s*$/mu.test(robots) ||
      !/^Allow:\s*\/\s*$/mu.test(robots)
    )
      fail("robots.txt lacks the public allow policy");
    const sitemap_pattern = new RegExp(
      `^Sitemap:\\s*${escape_regex(site_origin_url.origin)}/.*sitemap\\.xml$`,
      "mu",
    );
    if (!sitemap_pattern.test(robots))
      fail("robots.txt has no absolute sitemap reference");
  }

  if (existsSync(path.join(dist, "llms.txt"))) {
    const llms = read("llms.txt");
    if (!/^#\s+Solarisael\s*$/mu.test(llms))
      fail("llms.txt lacks its site heading");
    if (!/https:\/\/[^\s)]+/u.test(llms))
      fail("llms.txt has no absolute public links");
  }

  if (existsSync(path.join(dist, "rss.xml"))) {
    const rss = read("rss.xml");
    parse_xml(rss, "rss.xml");
    if (
      !/^<\?xml/iu.test(rss) ||
      !/<rss\s+version=["']2\.0["']/iu.test(rss) ||
      !/<channel>/iu.test(rss) ||
      !/<\/channel>\s*<\/rss>\s*$/iu.test(rss)
    )
      fail("rss.xml is not complete RSS 2.0 XML");
    const item_blocks = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map(
      (match) => match[1],
    );
    const expected_posts = [...indexable_urls].filter((url) =>
      /^\/(?:nigredo|albedo)\/[^/]+\/$/u.test(route_path(url)),
    );
    if (item_blocks.length !== expected_posts.length)
      fail(
        `rss.xml has ${item_blocks.length} items for ${expected_posts.length} dated writing posts`,
      );
    for (const item of item_blocks) {
      const title = item.match(/<title>([^<]+)<\/title>/u)?.[1];
      const link = item.match(/<link>([^<]+)<\/link>/u)?.[1];
      const guid = item.match(/<guid[^>]*>([^<]+)<\/guid>/u)?.[1];
      const description = item.match(
        /<description>([^<]+)<\/description>/u,
      )?.[1];
      const pub_date = item.match(/<pubDate>([^<]+)<\/pubDate>/u)?.[1];
      if (!title || !description || !link || !guid || !pub_date)
        fail("rss.xml item lacks title, description, link, guid, or pubDate");
      if (link !== guid) fail(`rss.xml guid does not match link: ${link}`);
      if (link && !indexable_urls.has(link))
        fail(`RSS item has no indexable page: ${link}`);
      if (pub_date && Number.isNaN(Date.parse(pub_date)))
        fail(`RSS item has invalid pubDate: ${pub_date}`);
    }
  }

  if (existsSync(path.join(dist, "search-index.json"))) {
    try {
      const index = JSON.parse(read("search-index.json"));
      if (!Array.isArray(index)) {
        fail("search-index.json is not an array");
      } else {
        const indexed_urls = new Set();
        for (const item of index) {
          if (!item || typeof item !== "object") {
            fail("search index contains a non-object item");
            continue;
          }
          for (const key of [
            "path",
            "title",
            "description",
            "text",
            "section",
          ]) {
            if (typeof item[key] !== "string")
              fail(`search index item lacks string ${key}`);
          }
          if (!item.text?.trim())
            fail(`search index has no rendered public content: ${item.path}`);
          if (!item.path) continue;
          try {
            const url = new URL(item.path, site_origin_url).href;
            indexed_urls.add(url);
            if (!canonical_urls.has(url))
              fail(`search index path has no page: ${item.path}`);
          } catch {
            fail(`search index path is not a URL: ${item.path}`);
          }
        }
        if (indexable_urls.size > 0 && index.length === 0)
          fail("search-index.json is empty while indexable pages exist");
        if (indexed_urls.size !== index.length)
          fail("search-index.json contains duplicate canonical paths");
        if (indexed_urls.size !== indexable_urls.size)
          fail(
            "search-index.json canonical paths do not match indexable pages",
          );
        for (const url of indexable_urls)
          if (!indexed_urls.has(url))
            fail(`indexable page missing from search index: ${url}`);
        for (const url of indexed_urls)
          if (!indexable_urls.has(url))
            fail(`non-indexable page appears in search index: ${url}`);
      }
    } catch {
      fail("search-index.json is not valid JSON");
    }
  }
}

if (failures.length > 0) {
  console.error(`site:check failed with ${failures.length} fault(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    "site:check passed: metadata, discovery endpoints, local resources, and public index boundaries are coherent.",
  );
}
