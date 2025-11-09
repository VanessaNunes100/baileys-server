# BAILEYS_SERVER_SETUP.md

## Objetivo
Este guia descreve como configurar o servidor Node.js que roda Baileys, expõe endpoints HTTP (/api/...) e um WebSocket (/ws) usado como ponte para o Edge Function (proxy).

---

## Requisitos
- Node.js 18+
- NPM ou Yarn
- Storage persistente para `auth` (credenciais)
- Certificado HTTPS (let's encrypt / host provider) se for expor publicamente
- Recomendações: Docker + Volume persistente

---

## Passos (local -> produção)

1. Clone o repositório
   ```bash
   git clone <repo-url>
   cd baileys-server
   ```

2. Instale dependências
   ```bash
   npm ci
   ```

3. Configure variáveis de ambiente (exemplo `.env`)
   ```
   PORT=3000
   AUTH_DIR=./auth
   NODE_ENV=production
   ```

4. Rode localmente (teste)
   ```bash
   npm start
   # abra http://localhost:3000/api/status
   ```

5. Faça deploy (opções)
   - **Railway**: conectar repo + adicionar volume persistente (disk) para `auth`
   - **DigitalOcean App / Droplet**: usar Docker + volume
   - **VPS (Ubuntu)**: rodar com PM2 / Docker, mapear porta 3000 e garantir HTTPS (NGINX reverse proxy + certbot)

6. Configurar HTTPS / WSS
   - Se usar Railway/Render, geralmente já tem HTTPS.
   - Se for VPS, configure Nginx com proxy_pass para `http://localhost:3000` e certbot para HTTPS.

7. Persistência
   - O diretório `AUTH_DIR` deve ser montado em disco persistente. Sem isso, a cada restart você perde sessão e precisa re-scanear QR.

8. Segurança
   - Proteja endpoints com chave `x-api-key` (middleware) para evitar uso indevido.
   - Valide origem no handshake do WebSocket.

---

## Endpoints principais
- `GET /api/status` — health check
- `GET /api/sessions` — lista arquivos da pasta de auth
- `POST /api/message/send` — enviar mensagem: `{ to, text }`
- `WS /ws` — WebSocket para eventos e QR codes (envia `type: "qr"` e `type: "connected"`)

---

## Testes
- Health:
  ```
  curl https://seu-dominio/api/status
  ```
- Envio:
  ```
  curl -X POST https://seu-dominio/api/message/send \
    -H "Content-Type: application/json" \
    -d '{"to":"55319XXXXXXX","text":"teste"}'
  ```
- WS:
  - No browser console:
  ```js
  const ws = new WebSocket("wss://seu-dominio/ws");
  ws.onmessage = (e) => console.log(e.data);
  ```

---

## Observações finais
- Monitore logs (PM2 / Railway logs).
- Se precisar de suporte para múltiplas instâncias, é necessário um orquestrador que gerencie autenticação por instância (cada instância tem seu `AUTH_DIR`).
- Para integrar com o Lovable: adicione `BAILEYS_SERVER_URL=https://seu-dominio/api/` nos Secrets e `BAILEYS_SERVER_WS=wss://seu-dominio/ws` no Edge Function.
