# Shorts-Maker

**Motion Studio** — hand-build an animated vertical Short (up to 60s) from
a scene editor. Nine canvas-drawn chart blocks, a synthesized Web Audio
score (or drop in your own local audio track instead), and MediaRecorder
export, all dark-themed, mobile-friendly, and fully client-side. No
account, no API key, no backend — nothing to sign up for.

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
  app.js            UI wiring
```

No bundler, no build step, no `npm install` — GitHub Pages serves the ES
modules directly.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Everything works immediately and fully
offline — canvas rendering, the synthesized score, the scene JSON editor,
and export.

## Writing scenes

There's no AI generation step — you write (or paste) a scene spec directly
into the **Scenes** editor and press Apply. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full scene spec schema, the
nine block types, and the module breakdown. `ARCHITECTURE.md` also
documents optional ways to add a prompt-to-scene AI step back in later
(bring-your-own-key or a Cloudflare Worker proxy) if you ever want that —
this repo doesn't ship either by default.

## Deploy

`.github/workflows/static.yml` deploys to GitHub Pages on every push to
`main`. One-time setup: **Settings → Pages → Source: GitHub Actions**. The
site is then live at `https://YOURNAME.github.io/Shorts-Maker/`.
