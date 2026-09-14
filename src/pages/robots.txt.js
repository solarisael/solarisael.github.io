import { base_path } from "../utils/routes.js";

export const GET = ({ site }) => {
  const origin = site?.origin ?? "https://solarisael.github.io";
  const sitemap_url = new URL(`${base_path}/sitemap.xml`, `${origin}/`).href;

  return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemap_url}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
