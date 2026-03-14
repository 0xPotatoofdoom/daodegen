# Dao DeGen QA Assessment (February 2026)

Prepared for: Product Management
Author: Codex QA (updated 2026-02-21)
Scope: Comprehensive desktop review of the monorepo (`contracts`, `frontend`, docs) to evaluate launch readiness and enumerate blocking issues before a production push.

---

## 1. Summary

Overall launch readiness has improved from **D (High Risk)** to **C (Moderate Risk)**. Contracts are deployed to Unichain Sepolia, frontend reads from real on-chain data, authentication has nonce replay protection, env validation is enforced, CI gates are active, and the Jar uses a safe pull-based distribution pattern. Remaining blockers are the mock Lightning payment layer and operational monitoring.

---

## 2. Critical Findings

### RESOLVED

1. ~~**SIWE authentication can be replayed and bypassed**~~ -- Nonce store with 5-minute expiry and single-use burn is implemented (`lib/auth.ts`). JWT_SECRET is Zod-validated, hardcoded fallback removed. Agent registry has a real deployed address with revoke/pause capabilities.

2. ~~**Frontend contract wiring is entirely placeholder**~~ -- All contract addresses are real deployed Unichain Sepolia addresses in `lib/contracts.ts`. VerseMintButton calls `mint()` on-chain, useTokenStats reads from deployed contracts, swap page shows real token address, claim page reads balances/allowances from chain. `MintButton.tsx` (unused stub) deleted.

3. ~~**Deployment secrets and ops hygiene missing**~~ -- `.gitignore` is comprehensive (#73). CI pipeline runs Foundry tests + frontend lint/build/test. Zod env schema validates required vars at startup.

### STILL OPEN

4. **Payments/X402 are partially simulated** -- The verse oracle endpoints use real x402 USDC payments via the self-hosted facilitator. However, the legacy L402 (Lightning) payment path used by the agent dashboard is still mock/in-memory. `/api/l402/simulate` is guarded by environment check but still exists.

---

## 3. Major Findings

### RESOLVED

1. ~~**Root layout is client-only**~~ -- `app/layout.tsx` is now a server component. Providers are in a dedicated client wrapper. Validated by `layout.test.tsx`.

2. ~~**Jar economics DoS**~~ -- Refactored to pull-based pattern. `release()` writes to `claimable` mapping, holders call `claim()`. Gas benchmarks pass in `GasBenchmark.t.sol`.

3. ~~**Agent registry has no governance**~~ -- `revoke()`, `pause()`/`unpause()` implemented with `onlyOwner` guard. Validated by `AgentRegistryFeatures.t.sol`.

### STILL OPEN

4. **Service worker caches non-existent assets** -- `public/sw.js` ships CRA-era asset paths (`/static/js/bundle.js`). Next.js 16 never emits these. Should be removed or replaced with `next-pwa`.

---

## 4. Minor Findings / Polish Needs

- **WalletConnect project ID defaults to "demo"** (`packages/frontend/src/lib/wagmi.ts`). Make it a required env var.
- ~~**Token stats hook is fake**~~ **RESOLVED** -- `useTokenStats` now reads real on-chain data (NFT supply, token supply, Jar ETH balance).
- ~~**Docs vs. reality drift**~~ **RESOLVED** -- Stale docs consolidated and updated (2026-02-21 cleanup).

---

## 5. Test Coverage

### Contracts (Foundry)
- Unit tests, fuzz tests (10k runs), invariant tests (1000 runs), fork tests against Unichain Sepolia PoolManager, gas benchmarks -- all passing.

### Frontend (Vitest)
- 10 test files, 28 tests passing: auth, contracts, x402, env validation, security, middleware, health, infrastructure, layout.

### E2E (Playwright)
- Unpaid flow tests (402 validation, facilitator health, auth flow) and paid flow tests (real USDC settlement) available.

---

## 6. Recommendation to PM

The critical contract wiring and authentication issues are resolved. The remaining blockers before a production launch are:

1. Replace the mock Lightning payment layer with a real provider (or migrate all paid flows to x402/USDC).
2. Remove the stale service worker.
3. Add production monitoring and alerting.
4. Harden WalletConnect configuration.

See `docs/GAP_ANALYSIS.md` for the full prioritized list of remaining work.
