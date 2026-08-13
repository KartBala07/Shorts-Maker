# Shorts-Maker

**Motion Studio** — prompt in, animated vertical Short out. Nine canvas-drawn
chart blocks, a synthesized Web Audio score, and MediaRecorder export, all
dark-themed, mobile-friendly, and client-side.

## Structure

```
index.html
css/studio.css     colour tokens, layout, mobile breakpoints
js/
  util.js          canvas constants, easing, number formatting, text wrap
  palettes.js       colour tokens per palette (all dark video backgrounds)
  blocks.js         the 9 draw functions (counter, bars, lines, stack, grid, flow, versus, ticker, text)
  renderer.js       frame(t): scene timing + dispatch to blocks
  audio.js          synthesized score, lookahead scheduler
  export.js         MediaRecorder A/V capture
  generate.js       prompt -> scene spec, calls Anthropic directly with your own key
  app.js            UI wiring
worker/
  index.js          optional Cloudflare Worker: holds a shared Anthropic key server-side, rate-limits, forwards Generate requests
  wrangler.toml     Worker config (fill in ALLOWED_ORIGIN + KV namespace id)
```

No bundler, no build step, no `npm install` — GitHub Pages serves the ES
modules directly.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Everything works immediately — canvas
rendering, the synthesized score, the scene JSON editor, and export are all
fully client-side.

## Using Generate

Generate calls Claude directly from your browser using your own Anthropic
API key (bring-your-own-key) — no backend to deploy. Paste a key into
**Settings → Anthropic API key**; it's stored only in that browser's
`localStorage` and sent only to `api.anthropic.com`. Get a key at
[console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).

Every visitor to a deployed site needs their own key under this model —
fine for personal use, less so for sharing widely. If you want one shared
key that visitors don't need to supply themselves, deploy the optional
Cloudflare Worker proxy in `worker/` (see `ARCHITECTURE.md` section 6) and
point `js/generate.js` at it instead.

## Deploy

Push to `main`, then enable GitHub Pages: **Settings → Pages → Source:
Deploy from a branch → `main` / `/ (root)`**. The site is live at
`https://YOURNAME.github.io/Shorts-Maker/` in about a minute; every push
redeploys. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full guide,
including the scene spec schema and module breakdown.
