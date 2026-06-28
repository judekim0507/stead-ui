import adapter from '@sveltejs/adapter-static';

/**
 * Stead ships this app as a native Chromium WebUI (served at stead://sidebar).
 * We build it as a pure client-side SPA: adapter-static with a fallback shell,
 * absolute asset paths (so /_app/... resolves under the WebUI host root no
 * matter which client route the side panel opens), and no SSR/prerender.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) =>
			filename.split(/[/\\]/).includes('node_modules') ? undefined : true
	},
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		}),
		paths: {
			// Absolute (/_app/...) rather than relative (./_app/...): the WebUI data
			// source serves assets from the host root, and the side panel can open a
			// nested client route (stead://sidebar/ai-sidebar) without breaking paths.
			relative: false
		},
		appDir: '_app'
	}
};

export default config;
