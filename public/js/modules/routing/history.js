const history_scope_key = "solarisael-history-scope";
const history_scope = "page-shell-v2";

export const prepare_route_history = () => {
  try {
    if (sessionStorage.getItem(history_scope_key) === history_scope) {
      return;
    }

    // Invalidate snapshots rendered with the retired multi-wrapper shell.
    sessionStorage.removeItem("htmx-history-cache");
    sessionStorage.setItem(history_scope_key, history_scope);
  } catch (error) {
    globalThis.htmx.config.historyCacheSize = 0;
    console.warn(
      "History caching is unavailable; routes use server responses.",
      error,
    );
  }
};
