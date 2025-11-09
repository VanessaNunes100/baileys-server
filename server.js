import express from "express";
import makeWASocket, { DisconnectReason, useSingleFileAuthState } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";

const app = express();
const PORT = process.env.PORT || 8080;
const { state, saveState } = useSingleFileAuthState("./auth_info.json");

let sock;

// Endpoint de verificação de saúde (para Railway)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "✅ Baileys Server is running" });
});

// Inicia o servidor HTTP primeiro
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is running and listening on port ${PORT}`);
  startBaileys(); // inicia o Baileys depois que o servidor HTTP estiver ativo
});

async function startBaileys() {
  try {
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });

    sock.ev.on("creds.update", saveState);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log("🔁 Conexão fechada, tentando reconectar...");
        if (shouldReconnect) startBaileys();
      } else if (connection === "open") {
        console.log("✅ Conectado ao WhatsApp!");
      }
    });
  } catch (error) {
    console.error("❌ Erro ao iniciar Baileys:", error);
  }
}
