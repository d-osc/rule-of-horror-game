declare global {
  interface Window {
    /** Injected by the double-click single-file build: bare asset paths mapped to data URIs. */
    __FILE_ASSETS__?: Record<string, string>;
  }
}

/** In the double-click single-file build every asset rides inside the HTML; otherwise fall back to served paths. */
export const assetUrl = (path: string): string =>
  window.__FILE_ASSETS__?.[path.replace(/^\.?\//, '')] ?? `${import.meta.env.BASE_URL}${path}`;
