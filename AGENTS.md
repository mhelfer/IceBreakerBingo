<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Phone testing over HTTPS (QR scanner)

iOS Safari blocks `getUserMedia` on anything except `localhost` or HTTPS, so plain `http://<LAN-IP>:3000` won't open the camera. Two terminals:

```
pnpm dev                 # Next on localhost:3000 (talks to local Supabase)
pnpm dev:tunnel          # ngrok http 3000 → https://xxxx.ngrok-free.app
```

Install ngrok once (`brew install ngrok`, then `ngrok config add-authtoken …`). Open the tunnel URL on the phone; the Next server still reaches local Supabase over localhost, so no other config changes are needed. When the tunnel URL rotates (free tier), re-seed so the facilitator's copy-paste block picks it up — or set `NEXT_PUBLIC_APP_ORIGIN=https://xxxx.ngrok-free.app` before running `dev`.
