# Deploying the Agent to a VPS

> **Current recommended path is Railway — see `RAILWAY_DEPLOY.md`.** This
> guide is kept as an alternative for self-hosting on a plain VPS. Note it
> predates the `apps/api` bridge and `NEXT_PUBLIC_AGENT_FEED_URL` env var
> referenced below has since been replaced by `NEXT_PUBLIC_API_URL`
> (`apps/dashboard/src/lib/feed.ts`).

This covers running `apps/agent` (the multi-agent orchestrator + `/health` +
`/agent-feed.json` endpoints) on any plain Linux VPS (Ubuntu/Debian assumed).

## 0. Prerequisites

- A VPS with SSH access (Ubuntu 22.04+ recommended)
- Port 3001 reachable (or use the Cloudflare Tunnel option in step 4 to avoid
  opening ports entirely)
- Your filled-in `.env` file (copy from `.env.example`, **never commit it**)

## 1. Get the code onto the VPS

```bash
ssh <user>@<vps-ip>
git clone https://github.com/asroryandesfar-art/mantle-edge.git
cd mantle-edge
```

Then copy your local `.env` to the VPS (from your machine):

```bash
scp .env <user>@<vps-ip>:~/mantle-edge/.env
```

## 2. Option A — Docker (recommended)

Install Docker if needed:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

Build and run:

```bash
cd ~/mantle-edge
docker build -f apps/agent/Dockerfile -t mantle-edge-agent .
docker run -d \
  --name mantle-edge-agent \
  --restart unless-stopped \
  --env-file .env \
  -p 3001:3001 \
  mantle-edge-agent
```

Check it's alive:

```bash
curl http://localhost:3001/health
docker logs -f mantle-edge-agent
```

## 3. Option B — PM2 (no Docker)

```bash
# Node 20 + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
corepack enable

cd ~/mantle-edge
pnpm install --frozen-lockfile
pnpm --filter @mantle-edge/shared build
pnpm --filter @mantle-edge/agent build

npm install -g pm2
pm2 start apps/agent/ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed command to enable on boot
```

Logs: `pm2 logs mantle-edge-agent` (also written to `apps/agent/logs/`).

## 4. Expose `/agent-feed.json` over HTTPS

The dashboard is served over **HTTPS** (Vercel). If the agent is plain HTTP,
browsers will block the dashboard's fetch to it (mixed-content). Two options:

### Fastest: Cloudflare Tunnel (no domain needed)

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
cloudflared tunnel --url http://localhost:3001
```

This prints a public `https://<random>.trycloudflare.com` URL that proxies to
your agent. Use that as `NEXT_PUBLIC_AGENT_FEED_URL` (see step 5). To keep it
running, run it under PM2 too:

```bash
pm2 start cloudflared --name agent-tunnel -- tunnel --url http://localhost:3001
pm2 save
```

### Alternative: nginx + Let's Encrypt (if you have a domain)

Standard reverse proxy + `certbot --nginx` to terminate TLS, proxying to
`http://localhost:3001`.

## 5. Point the dashboard at the live agent

Open the dashboard's firewall/CORS is already handled (`/agent-feed.json`
sets `Access-Control-Allow-Origin: *`). Set the env var on Vercel:

```bash
cd ~/mantle-edge   # on your local machine
vercel env rm NEXT_PUBLIC_AGENT_FEED_URL preview --yes
vercel env add NEXT_PUBLIC_AGENT_FEED_URL preview "" --value "https://<your-agent-url>/agent-feed.json" --yes
vercel --prod   # or redeploy preview
```

Verify: `curl https://<your-agent-url>/agent-feed.json` returns JSON, and the
live dashboard's panels start updating from it.
