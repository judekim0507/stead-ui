// The new tab page is shown constantly, so it must paint instantly — not wait
// for the SPA to boot. Prerender it to real static HTML at build time (overrides
// the app-wide ssr=false); the WebUI serves that, so a new tab paints the page
// immediately and the client just hydrates it for interactivity.
export const ssr = true;
export const prerender = true;
