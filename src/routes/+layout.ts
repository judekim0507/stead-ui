// Stead WebUI is a pure client-side SPA hosted in a native side panel.
// No server, no prerender — the adapter-static fallback shell boots the
// client router, which renders whichever route the side panel opened.
export const ssr = false;
export const prerender = false;
