// Proxies football-data.org API requests so the static site (GitHub Pages)
// can call them without hitting football-data.org's CORS restrictions.
// The API key lives only here as a Cloudflare secret, never in the browser.

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const apiUrl = `https://api.football-data.org/v4${url.pathname}${url.search}`;

    const apiRes = await fetch(apiUrl, {
      headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY },
    });

    return new Response(apiRes.body, {
      status: apiRes.status,
      headers: {
        ...corsHeaders,
        "Content-Type": apiRes.headers.get("Content-Type") || "application/json",
      },
    });
  },
};
