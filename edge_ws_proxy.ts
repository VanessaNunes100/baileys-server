// edge_ws_proxy.ts (Deno Deploy / Edge Function)
// Env required: BAILEYS_SERVER_WS (ex: wss://vanevu.web-conversa.top/ws)
const BAILEYS_SERVER_WS = Deno.env.get("BAILEYS_SERVER_WS") || "ws://173.249.47.246:8080";

addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});

async function handle(req: Request) {
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("OK - no websocket", { status: 200 });
  }

  // Accept client websocket
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  try {
    const baileysSocket = new WebSocket(BAILEYS_SERVER_WS);

    baileysSocket.addEventListener("open", () => {
      // accept client after remote open
      server.accept();
      baileysSocket.addEventListener("message", (ev) => {
        try { server.send(ev.data); } catch (e) {}
      });
      server.addEventListener("message", (ev) => {
        try { baileysSocket.send(ev.data); } catch (e) {}
      });
      server.addEventListener("close", () => { baileysSocket.close(); });
      baileysSocket.addEventListener("close", () => { server.close(); });
    });

    baileysSocket.addEventListener("error", (e) => {
      try { server.send(JSON.stringify({ type: "error", message: "baileys ws error" })); } catch (e) {}
      server.close();
    });

    return new Response(pair[1], { status: 101, webSocket: pair[1] });
  } catch (err) {
    return new Response("Failed to connect to baileys ws: " + String(err), { status: 502 });
  }
}
