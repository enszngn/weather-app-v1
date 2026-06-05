import { onRequestPost } from "../functions/api.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Eğer istek /api rotasına ve POST metoduna yapıldıysa
    if (url.pathname === "/api" || url.pathname === "/api/") {
      if (request.method === "POST") {
        // Cloudflare Pages Functions stili 'context' nesnesini simüle ediyoruz
        const context = {
          request,
          env,
          waitUntil: (promise) => ctx.waitUntil(promise),
          next: () => new Response("Not Found", { status: 404 })
        };
        return onRequestPost(context);
      } else {
        return new Response("Method Not Allowed", { status: 405 });
      }
    }

    // Diğer tüm rotalar için './dist' içindeki statik dosyaları (React frontend) sunuyoruz
    return env.ASSETS.fetch(request);
  }
};
