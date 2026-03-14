# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/frontend/package.json packages/frontend/package.json
RUN npm ci

FROM deps AS builder

ARG NEXT_PUBLIC_VERSE_NFT_ADDRESS=0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50
ARG NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS=0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16
ARG NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS=0xd25a5C67F180811e43990B2A0148Ac0d93ab9336
ARG NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0xBFE569F809b644703175Be603684Be0b7f6eee89
ARG NEXT_PUBLIC_PRAYER_BURN_ADDRESS=0x38C7AD96C2f5c90BE692605a7a7B633071122c72
ARG NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=build-placeholder

# Server-side env vars needed at build time for Next.js page data collection.
# These are build-time placeholders only -- override at runtime.
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
