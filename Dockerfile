# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/frontend/package.json packages/frontend/package.json
RUN npm ci

FROM deps AS builder

ARG NEXT_PUBLIC_VERSE_NFT_ADDRESS=0x39032854eD3512A7cB4f62158bC9004db6dDe5dC
ARG NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS=0x2719dcB70D7cA9DDbB018D7795Ee2F2A98f80947
ARG NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS=0x78D404fAaED5Ff2db7dC960A8F0798589bB6cd9b
ARG NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0x8105821036A5AD70B1291787C2Eabf455038eE20
ARG NEXT_PUBLIC_PRAYER_BURN_ADDRESS=0x2aFB7e968D034BBbe0c53E27C4359192D72544ae
ARG NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=build-placeholder

# Server-side env vars needed at build time for Next.js page data collection.
# These are build-time placeholders only -- override at runtime.
# SECURITY: JWT_SECRET=build-placeholder is blocked in production by env.ts
# validation. The runtime container MUST set a real secret (>= 32 chars).
ENV JWT_SECRET=build-placeholder
ENV FACILITATOR_URL=http://localhost:4402
ENV X402_PAY_TO=0x0000000000000000000000000000000000000000

ENV NEXT_PUBLIC_VERSE_NFT_ADDRESS=$NEXT_PUBLIC_VERSE_NFT_ADDRESS
ENV NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS=$NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS
ENV NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS=$NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS
ENV NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=$NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS
ENV NEXT_PUBLIC_PRAYER_BURN_ADDRESS=$NEXT_PUBLIC_PRAYER_BURN_ADDRESS
ENV NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID

COPY . .
RUN npm run frontend:build
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/frontend ./packages/frontend
EXPOSE ${PORT}
USER node
CMD ["npm", "run", "frontend:start"]
