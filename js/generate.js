// Bring-your-own-key: calls api.anthropic.com directly from the browser
// using a key the visitor pastes into Settings and that never leaves their
// own localStorage. No backend to deploy — this works the moment the site
// is live. (See ARCHITECTURE.md Option B. Option C, a Cloudflare Worker
// proxy that hides a shared key server-side, lives in worker/ if you'd
// rather not ask visitors for their own key.)
const STORAGE_KEY = "motionStudio.anthropicKey";

export function getStoredKey() {
  try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
}
export function setStoredKey(key) {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* localStorage unavailable (private mode etc.) — key just won't persist */ }
}

export function buildPrompt(topic, seconds) {
return `Design one vertical finance Short as a sequence of animated scenes. Topic: "${topic}". Total runtime: ${seconds} seconds. There is no narration — the visuals and on-screen text carry the whole thing, so every scene must be readable in silence.

Structure: open cold on a number or motion (no greeting), build tension, land a payoff that is a DIFFERENCE rather than a total, and close on a line that makes the replay feel intentional. Use 3 to 5 scenes. Vary the block types — do not use the same block twice in a row.

Rules: no stock picks, no buy or sell recommendations, no predictions, no guru tone. Use real, checkable figures with standard assumptions. Titles must be under 9 words because they render large.

Blocks:
{"kind":"counter","from":0,"to":50000,"pre":"$","suf":"","label":"caption"}
{"kind":"bars","pre":"","suf":"%","rows":[{"label":"","value":0,"hot":false}]}
{"kind":"lines","compound":{"rate":8,"end":65,"a":{"label":"","age":18,"monthly":200},"b":{"label":"","age":28,"monthly":200}}}
{"kind":"lines","series":[{"label":"","values":[1,2,3]}],"xLabels":["2000","2025"]}
{"kind":"stack","pre":"$","suf":"","segments":[{"label":"","value":0,"hot":false}]}
{"kind":"grid","total":10,"filled":7,"cols":5,"label":"caption"}
{"kind":"flow","hot":2,"steps":[{"label":""}]}
{"kind":"versus","left":{"label":"","value":0,"pre":"$"},"right":{"label":"","value":0,"pre":"$","hot":true}}
{"kind":"ticker","items":["-$1,240","+$310"]}
{"kind":"text","hot":1,"lines":["short line","short line"]}

Reply with ONLY raw JSON, no fences, no preamble:
{"meta":{"palette":"terminal|ember|ice|bone","mood":"pulse|tick|drift|lift"},
 "scenes":[{"dur":3,"title":"","sub":"","vis":{...}}]}`;
}

export async function generateScenes(topic, seconds) {
  const key = getStoredKey();
  if (!key) throw new Error("no API key set — add one in Settings");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: buildPrompt(topic, seconds) }]
    })
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("that key was rejected — check it in Settings");
    throw new Error("HTTP " + res.status);
  }
  const data = await res.json();
  const txt = (data.content || []).filter(x => x.type === "text").map(x => x.text).join("\n");
  const clean = txt.replace(/```json/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
  if (!parsed.scenes || !parsed.scenes.length) throw new Error("no scenes came back");
  return parsed;
}
