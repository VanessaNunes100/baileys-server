// server.js
// Node 18+
// npm i express ws @adiwajshing/baileys qrcode-terminal body-parser
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@adiwajshing/baileys";
import qrcode from "qrcode-terminal";
import bodyParser from "body-parser";
import fs from "fs";

const PORT = process.env.PORT || 3000;
const AUTH_DIR = process.env.AUTH_DIR || "./auth"; // onde ficam arquivos de sessão

await fs.promises.mkdir(AUTH_DIR, { recursive: true });

const app = express();
app.use(bodyParser.json());

// health
app.get("/api/status", (req, res) => res.json({ status: "ok", env: process.env.NODE_ENV || "dev" }));

// simple session list
app.get("/api/sessions", async (req, res) => {
  const files = await fs.promises.readdir(AUTH_DIR);
  res.json({ sessions: files });
});

/*
  Endpoint de envio via HTTP:
  POST /api/message/send
  { "to": "55319xxxxxxx@s.whatsapp.net" OR "55319xxxxxxx", "text": "Olá" }
*/
app.post("/api/message/send", async (req, res) => {
  try {
    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ error: "to and text required" });
    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
    if (!global.sock || global.sock.state !== "open") return res.status(500).json({ error: "no connection" });
    const sent = await global.sock.sendMessage(jid, { text });
    return res.json({ ok: true, messageId: sent.key });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// start HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// create Baileys socket
async function startBaileys() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    version,
    logger: { level: "info" },
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
      // broadcast qr to all connected WS clients
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: "qr", data: qr }));
        }
      });
    }
    if (connection === "open") {
      console.log("Baileys conectado");
      wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(JSON.stringify({ type: "connected" }));
      });
    }
    if (connection === "close") {
      console.warn("Baileys connection closed", update);
    }
  });

  sock.ev.on("messages.upsert", (m) => {
    // broadcast incoming messages to ws clients
    wss.clients.forEach(client => {
      if (client.readyState === 1) client.send(JSON.stringify({ type: "message", data: m }));
    });
  });

  global.sock = sock;
}

wss.on("connection", (ws) => {
  console.log("WS client connected to /ws");
  ws.send(JSON.stringify({ type: "hello", msg: "connected to baileys server" }));
  ws.on("message", async (msg) => {
    try {
      const payload = JSON.parse(msg.toString());
      if (payload.action === "send") {
        const to = payload.to.includes("@") ? payload.to : `${payload.to}@s.whatsapp.net`;
        const response = await global.sock.sendMessage(to, { text: payload.text });
        ws.send(JSON.stringify({ type: "sent", data: response }));
      }
    } catch (e) {
      console.error("ws msg error", e);
    }
  });
});

server.listen(PORT, async () => {
  console.log(`Baileys server listening on port ${PORT}`);
  await startBaileys();
});
