# Motion Studio — build & deploy guide

Turning the single-file prototype into a real site on GitHub.

---

## 1. What you already have

`motion-studio.html` is a complete, working application. Rename it to `index.html`, push it, and it deploys as-is. Everything below is about splitting it into maintainable files and solving the one part that breaks on static hosting.

**Works on GitHub Pages with zero changes:**

| Feature | Why it works |
|---|---|
| Canvas renderer (9 blocks) | Pure client-side drawing |
| Web Audio score | Synthesized in the browser |
| MediaRecorder export | Browser API, no server |
| Scene JSON editor | Local state only |

**Breaks on GitHub Pages:** the Generate button. It calls `api.anthropic.com`, which needs a key.

---

## 2. The API key problem

You have three options. Pick one before you write any other code, because it decides your whole architecture.

### Option A — ship without AI generation
Delete the Generate button. Keep the scene editor. The app becomes a hand-driven animation tool with no backend, no cost, no rate limits.

- **Effort:** none
- **Cost:** $0 forever
- **Good if:** you mostly write your own scenes anyway

### Option B — bring your own key (BYOK)
Add a settings field where the *user* pastes their own Anthropic key. Store it in `localStorage`, never in your repo.

```js
const key = localStorage.getItem('anthropic_key');
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  },
  body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [...] })
});
```

- **Effort:** ~20 lines
- **Cost:** $0 to you — each user pays their own usage
- **Trade-off:** friction. Most visitors won't have a key.

### Option C — serverless proxy (recommended)
A tiny function holds your key and forwards requests. Cloudflare Workers free tier is 100,000 requests/day, which you will not hit.

Frontend calls `/api/generate` instead of Anthropic directly. Worker code is in section 6.

- **Effort:** one file, ~40 lines
- **Cost:** $0 up to the free tier, then your Anthropic usage
- **Watch out:** anyone can hit your endpoint, so add the rate limit shown in section 6

---

## 3. Repo layout

```
motion-studio/
├── index.html
├── css/
│   └── studio.css
├── js/
│   ├── palettes.js      # colour tokens
│   ├── util.js          # easing, number formatting, text wrap
│   ├── blocks.js        # the 9 draw functions
│   ├── renderer.js      # frame(t), scene timing
│   ├── audio.js         # score synthesis
│   ├── export.js        # MediaRecorder A/V capture
│   ├── generate.js      # prompt → scene spec
│   └── app.js           # UI wiring
├── worker/
│   └── index.js         # Cloudflare Worker (Option C only)
├── .gitignore
└── README.md
```

Use ES modules — no bundler, no build step, no `npm install`. GitHub Pages serves them directly.

```html
<script type="module" src="./js/app.js"></script>
```

```js
// js/app.js
import { frame }        from './renderer.js';
import { startMusic }   from './audio.js';
import { exportVideo }  from './export.js';
import { generate }     from './generate.js';
```

**`.gitignore`** — first file you write:
```
.env
.dev.vars
node_modules/
*.webm
.DS_Store
```

---

## 4. The scene spec

This schema is the contract between the AI, the editor, and the renderer. Keep it stable and everything else stays swappable.

```json
{
  "meta": { "palette": "terminal", "mood": "pulse" },
  "scenes": [
    { "dur": 3, "title": "", "sub": "", "vis": { "kind": "..." } }
  ]
}
```

`dur` values are relative weights, normalised to the runtime slider — a scene with `dur: 3` alongside one with `dur: 6` takes a third of the video.

### Blocks

| kind | Fields | Use for |
|---|---|---|
| `counter` | `from, to, pre, suf, label` | One number climbing |
| `bars` | `rows[{label,value,hot}], pre, suf` | Comparing 2–6 figures |
| `lines` | `compound{rate,end,a,b}` or `series[], xLabels[]` | Compounding over time |
| `stack` | `segments[{label,value,hot}], pre, suf` | How a whole splits up |
| `grid` | `total, filled, cols, label` | A proportion as dots |
| `flow` | `steps[{label}], hot` | Sequential process |
| `versus` | `left{}, right{}` | Head-to-head |
| `ticker` | `items[]` | Cold open motion |
| `text` | `lines[], hot` | Typographic beat |

`hot` marks the element that gets the alarm colour. One per scene, maximum.

### Palettes and moods

Palettes: `terminal` `ember` `ice` `bone`
Moods: `pulse` `tick` `drift` `lift`

### The five beats

Every good Short follows this. Bake it into the generation prompt, not the code:

1. **Cold open** — a number is already moving, no greeting
2. **Stake** — one line saying what to watch
3. **Draw** — the chart animates, nothing else moves
4. **Gap** — payoff is a *difference*, not a total
5. **Loop** — closing frame invites the replay

---

## 5. Module breakdown

**`blocks.js`** — nine pure functions, all the same signature:

```js
export function grid(ctx, v, p, zone, palette) { ... }
```

`v` is the block object, `p` is 0→1 progress within the scene, `zone` is `{x:130, y:660, w:820, h:700}`. No block reads global state. That's what makes adding a tenth block a 30-line job.

**`renderer.js`** — owns `frame(t)`: resolves which scene is live at time `t`, computes local progress, draws title/sub, dispatches to the right block. Wrap the block call in try/catch so one malformed block can't blank the frame.

**`audio.js`** — a lookahead scheduler. Every 25ms it looks 120ms into the future and schedules notes on the Web Audio clock. Never schedule with `setTimeout` alone; it drifts audibly within seconds.

**`export.js`** — the part worth understanding:

```js
const videoTrack = canvas.captureStream(30).getVideoTracks()[0];
const audioTrack = streamDest.stream.getAudioTracks()[0];
const stream = new MediaStream([videoTrack, audioTrack]);
const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
```

`streamDest` is a `MediaStreamAudioDestinationNode` your audio graph connects to alongside `ac.destination`. That's how the score lands in the file instead of only in your speakers.

---

## 6. Cloudflare Worker proxy

`worker/index.js`:

```js
const ALLOWED = 'https://YOURNAME.github.io';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    // crude per-IP throttle
    const ip = request.headers.get('CF-Connecting-IP') ?? 'anon';
    const seen = await env.RATE.get(ip);
    if (seen && +seen > 20) return cors(new Response('Slow down', { status: 429 }));
    await env.RATE.put(ip, String((+seen || 0) + 1), { expirationTtl: 3600 });

    const body = await request.json();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: body.messages
      })
    });
    return cors(new Response(res.body, { status: res.status }));
  }
};

function cors(r) {
  r.headers.set('Access-Control-Allow-Origin', ALLOWED);
  r.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  r.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return r;
}
```

Setup:

```bash
npm create cloudflare@latest motion-worker
cd motion-worker
npx wrangler kv namespace create RATE     # add the id to wrangler.toml
npx wrangler secret put ANTHROPIC_API_KEY # paste when prompted, never commit
npx wrangler deploy
```

Then in `generate.js`, point at the worker URL instead of `api.anthropic.com`. Keep `ALLOWED` locked to your own origin — otherwise other sites can spend your credits.

---

## 7. Deploy

```bash
git init
git add .
git commit -m "Motion Studio"
git branch -M main
git remote add origin https://github.com/YOURNAME/motion-studio.git
git push -u origin main
```

Repo → **Settings → Pages** → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.

Live at `https://YOURNAME.github.io/motion-studio/` in about a minute. Every push redeploys.

Custom domain: add a `CNAME` file containing your domain, then point a CNAME DNS record at `YOURNAME.github.io`.

---

## 8. Worth building next

- **Local scene library** — save specs to `localStorage`, browse past videos
- **Safe-area overlay** — toggleable guides for where YouTube's UI covers the frame
- **Frame-accurate export** — current export is realtime; stepping the clock manually and using `canvas.captureStream(0)` with `requestFrame()` gives cleaner output on slow machines
- **Caption track** — burn short on-screen text at set timestamps, since there's no narration
- **Block #10** — a map, a waterfall, a pie. The signature is fixed, so it slots straight in.

---

## 9. Two things to keep in mind

**Verify the numbers.** With no narration the figures carry the whole video, and there's no voice to add a caveat. Spot-check anything generated against a real source before you publish. This is also what keeps you clear of the originality rules — a video where you've checked and framed the data is yours in a way an auto-generated one isn't.

**Don't ship a "make 50 videos" button.** The tool is fast enough to be dangerous that way, and channel-level review is exactly what catches batch-produced output. Fast production of videos you actually stand behind is the point; volume for its own sake is the thing that gets channels removed.
