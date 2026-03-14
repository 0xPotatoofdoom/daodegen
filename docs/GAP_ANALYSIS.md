# Dao DeGen Gap Analysis

Comprehensive assessment of the repository state (contracts, frontend, agent API, and operations) with explicit file references and recommended remediations for reaching production quality.

Last updated: 2026-02-21

## 1. Security & Authentication

- ~~**SIWE nonce replay risk**~~ **RESOLVED** -- Nonce store with expiry (5 min) and single-use burn implemented in `packages/frontend/src/lib/auth.ts`. Validated by `auth.test.ts`.
- **Dev-mode bypass of agent registry** -- `verifyAgentIdentity` returns `{ success: true }` whenever `CONTRACT_ADDRESSES.AGENT_REGISTRY === 0x0` (`packages/frontend/src/lib/auth.ts`). The registry address is now set to a real deployed contract in `contracts.ts`, but the zero-address fallback path still exists for local dev.
  _Remaining_: consider failing closed if registry address is zero in production builds.
- ~~**Static JWT secret**~~ **RESOLVED** -- `JWT_SECRET` is now validated via Zod schema (`lib/env.ts`). The hardcoded `'dev-secret-key'` fallback has been removed. `security.test.ts` asserts it is never that value.
- **Missing policy checks** -- SIWE verification does not confirm chain/network allowlists, statement, or audience beyond defaults. No replay log or threat intel feed.
- ~~**Agent registry openness**~~ **RESOLVED** -- `AgentRegistry.sol` now has `revoke()`, `pause()`/`unpause()`, and metadata validation. Tested in `AgentRegistryFeatures.t.sol`.

## 2. Payments / x402 Flow

- **Mock invoice store** -- `L402Service` tracks invoices in an in-memory `Map` and fabricates Bolt11 strings (`packages/frontend/src/lib/l402.ts`). Server restarts drop all payment state and there is no preimage verification.
  _Fix_: persist invoices (Redis/DB), integrate with a real provider (LNBits/Alby, etc.), and store preimage/payment state tied to the payer.
- **Public simulation endpoint** -- `/api/l402/simulate` marks invoices as paid for any request in non-production builds (`packages/frontend/src/app/api/l402/simulate/route.ts`). Now guarded by environment check (`security.test.ts` validates this). The Agent dashboard still calls this endpoint in dev mode.
  _Remaining_: remove simulation endpoint entirely once a real LN adapter ships.
- **Payment not bound to identity/content** -- `/api/premium` only checks for a JWT and `X-L402-Token` then returns a static quote. There is no entitlement record linking payment hash to agent to deliverable.
- **No webhook or settlement reconciliation** -- `lib/l402.ts` never listens for provider callbacks, so failed payments or partial settlements are invisible.
- **x402 (USDC) payment path exists** -- The verse oracle endpoints (`/v1/verse/lookup`, `/commentary`, `/oracle`) use real x402 protocol with USDC on Unichain Sepolia, settled by the self-hosted facilitator. This path is functional for verse oracle data.

## 3. Smart Contracts & Deployment

- ~~**Jar DoS vector**~~ **RESOLVED** -- Jar refactored to pull-based distribution pattern. `release()` writes to `claimable` mapping, holders call `claim()` to withdraw. Tested in `GasBenchmark.t.sol` and `DaoDeGenJar.t.sol`.
- ~~**Hook uses test helpers**~~ **RESOLVED** -- `DaoDeGenHook.sol` now inherits `IHooks` directly, not `BaseTestHooks`. Validated by `ProductionReadiness.t.sol`.
- ~~**No V4 integration tests**~~ **RESOLVED** -- Fork tests against real Unichain Sepolia PoolManager exist (`ForkTest.t.sol`), plus hook fee routing test in `DaoDeGenHook.t.sol`.
- ~~**Deployment placeholders**~~ **RESOLVED** -- All five contracts deployed to Unichain Sepolia. Addresses in `packages/frontend/src/lib/contracts.ts` and `packages/contracts/DEPLOYMENT.md`. Frontend reads from deployed contracts via wagmi hooks.
- ~~**Agent registry governance**~~ **RESOLVED** -- `revoke()` and `pause()`/`unpause()` implemented with `onlyOwner` guard.

## 4. Frontend / Product Experience

- ~~**Client-only root layout**~~ **RESOLVED** -- `app/layout.tsx` is now a server component. Providers are in a dedicated client wrapper.
- ~~**Stubbed user journeys**~~ **RESOLVED (#92)** -- `MintButton.tsx` deleted, `VerseMintButton.tsx` wired to real `mint()` call, `/swap` uses real token address from `contracts.ts`, `/claim` reads from deployed contracts, `useTokenStats` fetches on-chain data (NFT supply, token supply, Jar ETH balance).
- **Agent dashboard stuck in dev mode** -- Still calls `/api/l402/simulate` in non-production. Add environment-aware UI for production LN flows.
- **WalletConnect / RPC configuration** -- `wagmi.ts` still has a "demo-project-id" fallback. Treat WalletConnect ID and RPC URLs as required env vars.
- **Service worker mismatch** -- `public/sw.js` caches CRA-style assets (`/static/js/bundle.js`) that do not exist in Next.js 16. Produces 404s and stale caches. Remove it or generate a proper worker.
- **PWA manifest references** -- Layout preloads `/manifest.json`, but the manifest/service worker pair do not declare correct scopes or icons.

## 5. Operations, CI/CD, and Repo Hygiene

- ~~**Git hygiene**~~ **RESOLVED (#73)** -- `.gitignore` now covers `node_modules/`, Foundry `out/`/`cache/`/`broadcast/`, `.next/`, build artifacts, env files, and OS files. Committed `node_modules` purged.
- ~~**No CI gates**~~ **RESOLVED** -- GitHub Actions CI (`ci.yml`) runs Foundry tests, frontend lint/build, and test suites on PRs.
- **Docker deployment limited to frontend** -- `Dockerfile` and `docker-compose.staging.yml` only run `npm run frontend:start`. The agent API/payment logic (Next.js API routes) share the same process. No dedicated backend/worker split.
- ~~**Environment validation missing**~~ **RESOLVED** -- Zod-based env schema in `lib/env.ts` validates `JWT_SECRET` and other required vars. `env.test.ts` validates the schema.
- **Observability & monitoring** -- No structured logging, metrics, or alerting hooks beyond the health endpoint.

## 6. Remaining Work (Prioritized)

1. **Payment infrastructure** -- Replace mock L402 with real Lightning adapter or expand x402/USDC to cover all paid flows. Persist payment state. Add webhook reconciliation.
2. **Service worker cleanup** -- Remove `public/sw.js` or replace with `next-pwa` for proper Next.js caching.
3. **WalletConnect project ID** -- Make it a required env var; remove "demo-project-id" fallback.
4. **Agent dashboard production mode** -- Wire to real payment flow instead of `/api/l402/simulate`.
5. **SIWE policy hardening** -- Add chain/domain allowlists, consider failing closed on zero registry address in production.
6. **Monitoring & observability** -- Structured logging, error tracking, payment failure alerting.
7. **Docker topology** -- Decide on final deployment split for Mac mini + VPS topology.
