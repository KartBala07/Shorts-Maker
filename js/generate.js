// Talks to the Cloudflare Worker proxy in worker/index.js, never to
// api.anthropic.com directly — the browser has no Anthropic key and
// shouldn't. Replace GENERATE_ENDPOINT with your deployed Worker URL
// (see ARCHITECTURE.md section 6/7).
const GENERATE_ENDPOINT = "https://motion-studio-worker.YOUR-SUBDOMAIN.workers.dev";

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

export async function generateScenes(topic, seconds, endpoint = GENERATE_ENDPOINT) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: buildPrompt(topic, seconds) }] })
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  const txt = (data.content || []).filter(x => x.type === "text").map(x => x.text).join("\n");
  const clean = txt.replace(/```json/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
  if (!parsed.scenes || !parsed.scenes.length) throw new Error("no scenes came back");
  return parsed;
}
