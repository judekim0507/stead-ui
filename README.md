# Stead UI

The user interface for **Stead** — a performance-first agentic web browser built
as a Chromium fork. This is a SvelteKit app that's compiled to static assets and
served as native Chromium **WebUI** surfaces inside the browser (no extension, no
content scripts, no external daemon).

This repo is the **source**. The built bundle is vendored into the browser repo
([judekim0507/stead](https://github.com/judekim0507/stead)) under
`resources/stead/sidebar/`.

## Surfaces

One app, several routes — each wired into the browser as its own WebUI surface:

| Route          | In the browser                          |
| -------------- | --------------------------------------- |
| `/ai-sidebar`  | the **Ask Stead** side panel            |
| `/ai-chat`     | the full-page chat (`stead://chat`)     |
| `/new-tab`     | the **new tab page** (prerendered for instant paint) |

## Develop

```sh
bun install
bun dev          # iterate in any browser at localhost — instant, no Chromium build
bun run build    # static build → ./build (adapter-static, SPA + prerendered /new-tab)
```

To get changes into the actual Stead browser, run the sync script in the browser
repo (`resources/stead/sync_sidebar_ui.sh`), which rebuilds this app and vendors
the bundle in. See the browser repo's `DEVELOPMENT.md` for the full workflow.

## Stack

Svelte 5 (runes) · SvelteKit · Tailwind CSS v4 · `shadcn-svelte` components ·
`bits-ui` · `lucide` icons · Inter (`@fontsource-variable/inter`).

## License

Stead UI is licensed under the **GNU General Public License v3.0** — see
[LICENSE](LICENSE). It's part of the open-source Stead client, matching the
browser's GPL-3.0 license.

UI primitives under `src/lib/components/ui/` are generated from
[shadcn-svelte](https://shadcn-svelte.com) (MIT), which is GPL-compatible.
