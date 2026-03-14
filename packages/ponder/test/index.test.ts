import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock "ponder:schema" -- provide symbol-like table references so the handler
// code can pass them to db.insert / db.update without hitting real Ponder.
// ---------------------------------------------------------------------------
const schemaExports = {
  feeReleases: Symbol("feeReleases"),
  claims: Symbol("claims"),
  nftTransfers: Symbol("nftTransfers"),
  nftMints: Symbol("nftMints"),
  agents: Symbol("agents"),
  prayers: Symbol("prayers"),
};

vi.mock("ponder:schema", () => schemaExports);

// ---------------------------------------------------------------------------
// Mock "ponder:registry" -- capture every handler registered via ponder.on()
// so we can invoke them directly with mock event / context objects.
// ---------------------------------------------------------------------------
const handlers: Record<string, (args: { event: any; context: any }) => Promise<void>> = {};

const ponderMock = {
  on: (name: string, handler: (args: { event: any; context: any }) => Promise<void>) => {
    handlers[name] = handler;
  },
};

vi.mock("ponder:registry", () => ({ ponder: ponderMock }));

// ---------------------------------------------------------------------------
// Mock "viem" -- only toHex is used; replicate a simplified version.
// ---------------------------------------------------------------------------
vi.mock("viem", () => ({
  toHex: (value: any) => {
    if (typeof value === "string") {
      return (
        "0x" +
        Array.from(new TextEncoder().encode(value))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      );
    }
    return `0x${BigInt(value).toString(16)}`;
  },
}));

// ---------------------------------------------------------------------------
// Now import the module under test -- this will register all handlers.
// ---------------------------------------------------------------------------
await import("./index.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDR_A = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa";
const ADDR_B = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
const TX_HASH = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

function makeBaseEvent(overrides: Record<string, any> = {}) {
  return {
    id: "evt-1",
    block: { number: 42069n, timestamp: 1700000000n },
    transaction: { hash: TX_HASH },
    args: {},
    ...overrides,
  };
}

/** Create a mock context whose db operations are all spies. */
function makeMockContext() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const set = vi.fn().mockResolvedValue(undefined);

  const db = {
    insert: vi.fn().mockReturnValue({ values }),
    update: vi.fn().mockReturnValue({ set }),
  };

  return { db, spies: { insert: db.insert, values, onConflictDoUpdate, update: db.update, set } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Event handlers", () => {
  it("registers all expected handlers", () => {
    expect(handlers).toHaveProperty("DaoDeGenJar:FeesReleased");
    expect(handlers).toHaveProperty("DaoDeGenJar:Claimed");
    expect(handlers).toHaveProperty("VerseNFT:Transfer");
    expect(handlers).toHaveProperty("AgentRegistry:AgentRegistered");
    expect(handlers).toHaveProperty("AgentRegistry:AgentRevoked");
    expect(handlers).toHaveProperty("PrayerBurn:Prayer");
  });

  // -----------------------------------------------------------------------
  // DaoDeGenJar:FeesReleased
  // -----------------------------------------------------------------------
  describe("DaoDeGenJar:FeesReleased", () => {
    it("inserts a fee release record with correct fields", async () => {
      const { db, spies } = makeMockContext();
      const event = makeBaseEvent({
        args: {
          caller: ADDR_A,
          burnAmount: 5000000000000000000n,
          nftHolders: 3000000000000000000n,
        },
      });

      await handlers["DaoDeGenJar:FeesReleased"]!({ event, context: { db } });

      expect(spies.insert).toHaveBeenCalledWith(schemaExports.feeReleases);
      expect(spies.values).toHaveBeenCalledWith({
        id: "evt-1",
        caller: ADDR_A,
        burnAmount: 5000000000000000000n,
        nftHolders: 3000000000000000000n,
        txHash: TX_HASH,
        blockNumber: 42069n,
        timestamp: 1700000000n,
      });
    });
  });

  // -----------------------------------------------------------------------
  // DaoDeGenJar:Claimed
  // -----------------------------------------------------------------------
  describe("DaoDeGenJar:Claimed", () => {
    it("inserts a claim record with correct fields", async () => {
      const { db, spies } = makeMockContext();
      const event = makeBaseEvent({
        args: {
          tokenId: 7n,
          holder: ADDR_A,
          asset: ADDR_B,
          amount: 1000000000000000000n,
        },
      });

      await handlers["DaoDeGenJar:Claimed"]!({ event, context: { db } });

      expect(spies.insert).toHaveBeenCalledWith(schemaExports.claims);
      expect(spies.values).toHaveBeenCalledWith({
        id: "evt-1",
        tokenId: 7n,
        holder: ADDR_A,
        asset: ADDR_B,
        amount: 1000000000000000000n,
        txHash: TX_HASH,
        blockNumber: 42069n,
        timestamp: 1700000000n,
      });
    });
  });

  // -----------------------------------------------------------------------
  // VerseNFT:Transfer
  // -----------------------------------------------------------------------
  describe("VerseNFT:Transfer", () => {
    it("inserts an nftTransfer record for a normal transfer", async () => {
      const { db, spies } = makeMockContext();
      const event = makeBaseEvent({
        args: { from: ADDR_A, to: ADDR_B, tokenId: 42n },
      });

      await handlers["VerseNFT:Transfer"]!({ event, context: { db } });

      expect(spies.insert).toHaveBeenCalledTimes(1);
      expect(spies.insert).toHaveBeenCalledWith(schemaExports.nftTransfers);
      expect(spies.values).toHaveBeenCalledWith({
        id: "evt-1",
        from: ADDR_A,
        to: ADDR_B,
        tokenId: 42n,
        txHash: TX_HASH,
        blockNumber: 42069n,
        timestamp: 1700000000n,
      });
    });

    it("also inserts an nftMint record when from is the zero address", async () => {
      const { db, spies } = makeMockContext();
      const event = makeBaseEvent({
        args: { from: ZERO_ADDRESS, to: ADDR_B, tokenId: 1n },
      });

      await handlers["VerseNFT:Transfer"]!({ event, context: { db } });

      // Two inserts: one for nftTransfers, one for nftMints
      expect(spies.insert).toHaveBeenCalledTimes(2);
      expect(spies.insert).toHaveBeenNthCalledWith(1, schemaExports.nftTransfers);
      expect(spies.insert).toHaveBeenNthCalledWith(2, schemaExports.nftMints);

      // The second .values() call is for the mint
      expect(spies.values).toHaveBeenNthCalledWith(2, {
        id: "mint-evt-1",
        minter: ADDR_B,
        tokenId: 1n,
        txHash: TX_HASH,
        blockNumber: 42069n,
        timestamp: 1700000000n,
      });
    });

    it("does NOT insert nftMint when from is a non-zero address", async () => {
      const { db, spies } = makeMockContext();
      const event = makeBaseEvent({
        args: { from: ADDR_A, to: ADDR_B, tokenId: 99n },
      });

      await handlers["VerseNFT:Transfer"]!({ event, context: { db } });

      // Only one insert (nftTransfers)
      expect(spies.insert).toHaveBeenCalledTimes(1);
      expect(spies.insert).not.toHaveBeenCalledWith(schemaExports.nftMints);
    });
  });

  // -----------------------------------------------------------------------
  // AgentRegistry:AgentRegistered
  // -----------------------------------------------------------------------
  describe("AgentRegistry:AgentRegistered", () => {
    it("upserts an agent record with onConflictDoUpdate", async () => {
      const { db, spies } = makeMockContext();
      const event = makeBaseEvent({
        args: {
          agentAddress: ADDR_A,
          agentId: 1n,
          metadataURI: "ipfs://Qm123",
        },
      });

      await handlers["AgentRegistry:AgentRegistered"]!({ event, context: { db } });

      expect(spies.insert).toHaveBeenCalledWith(schemaExports.agents);
      expect(spies.values).toHaveBeenCalledWith({
        id: ADDR_A,
        agentAddress: ADDR_A,
        agentId: 1n,
        metadataURI: "ipfs://Qm123",
        registeredAt: 1700000000n,
        revokedAt: null,
      });
      expect(spies.onConflictDoUpdate).toHaveBeenCalledWith({
        agentId: 1n,
        metadataURI: "ipfs://Qm123",
        registeredAt: 1700000000n,
        revokedAt: null,
      });
    });
  });

  // -----------------------------------------------------------------------
  // AgentRegistry:AgentRevoked
  // -----------------------------------------------------------------------
  describe("AgentRegistry:AgentRevoked", () => {
    it("updates the agent revokedAt timestamp", async () => {
      const { db, spies } = makeMockContext();
      const event = makeBaseEvent({
        args: { agentAddress: ADDR_A },
      });

      await handlers["AgentRegistry:AgentRevoked"]!({ event, context: { db } });

      expect(spies.update).toHaveBeenCalledWith(schemaExports.agents, { id: ADDR_A });
      expect(spies.set).toHaveBeenCalledWith({ revokedAt: 1700000000n });
    });
  });

  // -----------------------------------------------------------------------
  // PrayerBurn:Prayer
  // -----------------------------------------------------------------------
  describe("PrayerBurn:Prayer", () => {
    it("inserts a prayer with hex-encoded message", async () => {
      const { db, spies } = makeMockContext();
      const event = makeBaseEvent({
        args: {
          sender: ADDR_A,
          amount: 100000000000000000n,
          message: "Bless the chain",
        },
      });

      await handlers["PrayerBurn:Prayer"]!({ event, context: { db } });

      expect(spies.insert).toHaveBeenCalledWith(schemaExports.prayers);

      const valuesArg = spies.values.mock.calls[0]![0];
      expect(valuesArg).toMatchObject({
        id: "evt-1",
        sender: ADDR_A,
        amount: 100000000000000000n,
        txHash: TX_HASH,
        blockNumber: 42069n,
        timestamp: 1700000000n,
      });
      // message should be hex-encoded via toHex
      expect(valuesArg.message).toMatch(/^0x[0-9a-f]+$/);
    });

    it("passes event.args.message through toHex from viem", async () => {
      const { toHex } = await import("viem");
      const { db, spies } = makeMockContext();
      const rawMessage = "Om mani padme hum";
      const event = makeBaseEvent({
        args: { sender: ADDR_A, amount: 1n, message: rawMessage },
      });

      await handlers["PrayerBurn:Prayer"]!({ event, context: { db } });

      const valuesArg = spies.values.mock.calls[0]![0];
      expect(valuesArg.message).toBe(toHex(rawMessage));
    });
  });
});
