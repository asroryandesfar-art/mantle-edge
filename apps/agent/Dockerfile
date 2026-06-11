# syntax=docker/dockerfile:1.7
# Build context must be the monorepo root, e.g.:
#   docker build -f apps/agent/Dockerfile -t mantle-edge-agent .

FROM node:22-alpine AS base
RUN corepack enable

# --- Build stage: install full workspace, build shared + agent, then -------
# isolate the agent + its prod deps into /out via `pnpm deploy`.
FROM base AS build
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mantle-edge/shared build
RUN pnpm --filter @mantle-edge/agent build
RUN pnpm --filter @mantle-edge/agent deploy --prod /out

# --- Runtime stage: minimal image with only the deployed agent -------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out .

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/multiAgentIndex.js"]
