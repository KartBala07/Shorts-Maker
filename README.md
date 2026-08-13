# Shorts-Maker

**Motion Studio** — prompt in, animated vertical Short out. Nine canvas-drawn
chart blocks, a synthesized Web Audio score, and MediaRecorder export, all
client-side and deployable as a static site.

## Structure

```
index.html
css/studio.css     colour tokens, layout
js/
  util.js          canvas constants, easing, number formatting, text wrap
  palettes.js       colour tokens per palette
  blocks.js         the 9 draw functions (counter, bars, lines, stack, grid, flow, versus, ticker, text)
  renderer.js       frame(t): scene timing + dispatch to blocks
  audio.js          synthesized score, lookahead scheduler
  export.js         MediaRecorder A/V capture
  generate.js       prompt -> scene spec, via the Worker proxy
  app.js            UI wiring
worker/
  index.js          Cloudflare Worker: holds the Anthropic key, rate-limits, forwards Generate requests
  wrangler.toml     Worker config (fill in ALLOWED_ORIGIN + KV namespace id)
```

No bundler, no build step, no `npm install` — GitHub Pages serves the ES
modules directly.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Everything works offline except the
Generate button, which needs the Worker proxy below.

## Deploy

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full guide: the scene
spec schema, module breakdown, and step-by-step GitHub Pages + Cloudflare
Worker deploy instructions.

Quick version:

1. Deploy `worker/` with Wrangler (`npx wrangler secret put ANTHROPIC_API_KEY`,
   then `npx wrangler deploy`) and note the Worker URL.
2. Update `GENERATE_ENDPOINT` in `js/generate.js` to that URL, and
   `ALLOWED_ORIGIN` in `worker/wrangler.toml` to your GitHub Pages origin.
3. Push to `main`, enable GitHub Pages (Settings → Pages → Deploy from a
   branch → `main` / `/ (root)`).
