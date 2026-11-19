/** Browser flow metadata. Full redacted request content is logged by the backend. */
function enabled(): boolean {
  try {
    const setting = localStorage.getItem("shadow.debug");
    return setting === "true" || (setting !== "false" && ["localhost", "127.0.0.1"].includes(location.hostname));
  } catch {
    return false;
  }
}

export function debugEvent(event: string, metadata: Record<string, unknown> = {}) {
  if (enabled()) console.debug("[ShadowClone]", new Date().toISOString(), event, metadata);
}

export function installDebugFetch() {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return original(input, init);
    const started = performance.now();
    const metadata = { path: url.pathname, method: init?.method ?? (input instanceof Request ? input.method : "GET") };
    debugEvent("http.request", metadata);
    try {
      const response = await original(input, init);
      debugEvent("http.response", { ...metadata, status: response.status, requestId: response.headers.get("x-request-id"), elapsedMs: Math.round(performance.now() - started) });
      return response;
    } catch (error) {
      debugEvent("http.error", { ...metadata, errorType: error instanceof Error ? error.name : "UnknownError" });
      throw error;
    }
  };
}
