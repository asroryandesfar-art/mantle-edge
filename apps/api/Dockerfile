# syntax=docker/dockerfile:1.7
# Build context must be the monorepo root, e.g.:
#   docker build -f apps/api/Dockerfile -t mantle-edge-api .

FROM node:22-alpine AS base
RUN corepack enable

# --- Build stage: install full workspace, build the api package, then ------
# isolate it + its prod deps into /out via `pnpm deploy`. better-sqlite3
# needs a native build toolchain on alpine.
FROM base AS build
RUN apk add --no-cache python3 make g++
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mantle-edge/api build
RUN pnpm --filter @mantle-edge/api deploy --prod /out

# --- Runtime stage: minimal image with only the deployed api ---------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out .

# SQLite database lives under apps/api/data relative to the app root
# (see src/config.ts dbPath). Mount a Railway volume here for persistence.
RUN mkdir -p /app/apps/api/data

EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3002)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
