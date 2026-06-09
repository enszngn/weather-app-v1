import { onRequestPost, onRequestGet, onRequestGetWeather } from "./api.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── Route: GET /api/weather ───────────────────────────────────────────────────
    // Server-side IP geolocation + Cloudflare Cache API + D1 visit logging.
    // Replaces the old client-side navigator.geolocation flow entirely.
    if (url.pathname === "/api/weather" || url.pathname === "/api/weather/") {
      if (request.method === "GET") {
        const context = {
          request,
          env,
          waitUntil: (promise) => ctx.waitUntil(promise),
          next: () => new Response("Not Found", { status: 404 })
        };
        return onRequestGetWeather(context);
      }
      return new Response("Method Not Allowed", { status: 405 });
    }

    // ── Route: /api ───────────────────────────────────────────────────────────────
    // POST: legacy visit log endpoint (kept for backwards compatibility).
    // GET:  stats dashboard data (password-protected).
    if (url.pathname === "/api" || url.pathname === "/api/") {
      if (request.method === "POST") {
        const context = {
          request,
          env,
          waitUntil: (promise) => ctx.waitUntil(promise),
          next: () => new Response("Not Found", { status: 404 })
        };
        return onRequestPost(context);
      } else if (request.method === "GET") {
        const context = {
          request,
          env,
          waitUntil: (promise) => ctx.waitUntil(promise),
          next: () => new Response("Not Found", { status: 404 })
        };
        return onRequestGet(context);
      } else {
        return new Response("Method Not Allowed", { status: 405 });
      }
    }

    // ── Fallthrough: serve static frontend assets ─────────────────────────────────
    return env.ASSETS.fetch(request);
  }
};
