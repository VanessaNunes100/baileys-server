import express from "express";
import makeWASocket from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { useSingleFileAuthState } from "@whiskeysockets/baileys";

const { state, saveState } = useSingleFileAuthState("./auth_info.json");
const app = express();

let sock;

async function startBaileys() {
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveState);
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBaileys();
    } else if (connection === "open") {
      console.log("✅ Conectado ao WhatsApp!");
    }
  });
}

startBaileys();

// endpoint para verificar se o servidor está rodando
app.get("/health", (req, res) => {
  res.json({ status: "Baileys Server is running ✅" });
});

// inicia o servidor HTTP na porta 8080 (necessário para o Railway)
app.listen(process.env.PORT || 8080, () => {
  console.log("🚀 Baileys server listening on port 8080");
});
