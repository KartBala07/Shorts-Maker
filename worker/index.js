// Holds the Anthropic key server-side and forwards Generate requests from
// the static site. Deploy with `wrangler deploy` (see ../ARCHITECTURE.md
// section 6/7). Needs a KV namespace bound as RATE and two config values:
//   - env.ANTHROPIC_API_KEY  (secret: `wrangler secret put ANTHROPIC_API_KEY`)
//   - env.ALLOWED_ORIGIN     (var in wrangler.toml, e.g. your GitHub Pages origin)
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), env);
    if (request.method !== "POST") return cors(new Response("Method not allowed", { status: 405 }), env);

    const ip = request.headers.get("CF-Connecting-IP") ?? "anon";
    const seen = await env.RATE.get(ip);
    if (seen && +seen > 20) return cors(new Response("Slow down", { status: 429 }), env);
    await env.RATE.put(ip, String((+seen || 0) + 1), { expirationTtl: 3600 });

    let body;
    try {
      body = await request.json();
    } catch {
      return cors(new Response("Invalid JSON body", { status: 400 }), env);
    }
    if (!Array.isArray(body.messages)) {
      return cors(new Response("Missing messages array", { status: 400 }), env);
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: body.messages
      })
    });
    return cors(new Response(res.body, { status: res.status }), env);
  }
};

function cors(r, env) {
  r.headers.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN || "");
  r.headers.set("Access-Control-Allow-Headers", "Content-Type");
  r.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return r;
}
