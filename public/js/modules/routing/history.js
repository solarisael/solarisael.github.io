const history_scope_key = "solarisael-history-scope";
const history_scope = "page-shell-v3-publication";

export const prepare_route_history = () => {
  try {
    if (sessionStorage.getItem(history_scope_key) === history_scope) {
      return;
    }

    // Invalidate snapshots without the current shell metadata payload.
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
