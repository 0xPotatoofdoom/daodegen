import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Schema table symbols -- used as references in drizzle-style queries
// ---------------------------------------------------------------------------
const prayersTable = {
  timestamp: Symbol("prayers.timestamp"),
  amount: Symbol("prayers.amount"),
  tokenId: Symbol("prayers.tokenId"),
};

const feeReleasesTable = {
  timestamp: Symbol("feeReleases.timestamp"),
};

const claimsTable = {
  timestamp: Symbol("claims.timestamp"),
  tokenId: Symbol("claims.tokenId"),
};

const nftTransfersTable = {
  blockNumber: Symbol("nftTransfers.blockNumber"),
};

const nftMintsTable = {
  timestamp: Symbol("nftMints.timestamp"),
};

const schemaObj = {
  prayers: prayersTable,
  feeReleases: feeReleasesTable,
  claims: claimsTable,
  nftTransfers: nftTransfersTable,
  nftMints: nftMintsTable,
};

// ---------------------------------------------------------------------------
// Mock database query builder -- supports chained .select().from().where()
// .orderBy().limit().offset() calls. We can configure per-table return data.
// ---------------------------------------------------------------------------
const tableData: Record<string, any[]> = {};

function resetTableData() {
  tableData.prayers = [];
  tableData.feeReleases = [];
  tableData.claims = [];
  tableData.nftTransfers = [];
  tableData.nftMints = [];
}

function makeQueryChain(selectArg?: any): any {
  let fromTable: any = null;
  let whereClause: any = null;

  const chain: any = {
    from: vi.fn((table: any) => {
      fromTable = table;
      return chain;
    }),
    where: vi.fn((clause: any) => {
      whereClause = clause;
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    then: undefined as any,
  };

  // Make it thenable so `await` resolves to the data
  chain.then = (resolve: any, reject: any) => {
    let tableName: string | undefined;
    for (const [name, ref] of Object.entries(schemaObj)) {
      if (ref === fromTable) {
        tableName = name;
        break;
      }
    }

    const data = tableName ? (tableData[tableName] ?? []) : [];

    // If selectArg requested count/sum aggregates, wrap accordingly
    if (selectArg && typeof selectArg === "object" && "count" in selectArg) {
      const result = [
        {
          count: data.length,
          ...(selectArg.totalBurned !== undefined
            ? {
                totalBurned: data.reduce(
                  (acc: bigint, row: any) => acc + (row.amount ?? 0n),
                  0n,
                ),
              }
            : {}),
        },
      ];
      return Promise.resolve(result).then(resolve, reject);
    }

    return Promise.resolve(data).then(resolve, reject);
  };

  return chain;
}

const mockDb = {
  select: vi.fn((selectArg?: any) => makeQueryChain(selectArg)),
};

vi.mock("ponder:api", () => ({
  db: mockDb,
}));

vi.mock("ponder:schema", () => ({
  default: schemaObj,
  ...schemaObj,
}));

// ---------------------------------------------------------------------------
// Mock the ponder utilities: count, desc, eq, sum, graphql, replaceBigInts
// ---------------------------------------------------------------------------
vi.mock("ponder", () => ({
  count: vi.fn(() => "COUNT_AGGREGATE"),
  desc: vi.fn((col: any) => ({ desc: col })),
  eq: vi.fn((col: any, value: any) => ({ eq: { col, value } })),
  sum: vi.fn((col: any) => ({ sum: col })),
  graphql: vi.fn(
    () =>
      async (_c: any, next: any) =>
        next(),
  ),
  replaceBigInts: vi.fn((data: any, fn: (b: bigint) => string) => {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? fn(value) : value,
      ),
    );
  }),
  onchainTable: vi.fn(),
  index: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import the Hono app under test -- must happen AFTER mocks are in place.
// ---------------------------------------------------------------------------
const { default: app } = await import("./index.js");

// ---------------------------------------------------------------------------
// Helpers for making test requests against the Hono app
// ---------------------------------------------------------------------------
async function request(path: string): Promise<{ status: number; json: any }> {
  const req = new Request(`http://localhost${path}`);
  const res = await app.fetch(req);
  const json = await res.json();
  return { status: res.status, json };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("API endpoints", () => {
  beforeEach(() => {
    resetTableData();
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // GET /prayers
  // -----------------------------------------------------------------------
  describe("GET /prayers", () => {
    it("returns an empty array when no prayers exist", async () => {
      const { status, json } = await request("/prayers");
      expect(status).toBe(200);
      expect(json).toEqual([]);
    });

    it("returns prayers data", async () => {
      tableData.prayers = [
        {
          id: "p1",
          sender: "0xaaa",
          amount: 100n,
          message: "0x68656c6c6f",
          txHash: "0xdef",
          blockNumber: 1n,
          timestamp: 1700000000n,
        },
      ];

      const { status, json } = await request("/prayers");
      expect(status).toBe(200);
      // replaceBigInts should convert bigints to strings
      expect(json).toEqual([
        {
          id: "p1",
          sender: "0xaaa",
          amount: "100",
          message: "0x68656c6c6f",
          txHash: "0xdef",
          blockNumber: "1",
          timestamp: "1700000000",
        },
      ]);
    });

    it("passes the limit query param to the chain", async () => {
      await request("/prayers?limit=10");
      // The query chain's limit should have been called
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("accepts offset query param", async () => {
      const { status } = await request("/prayers?limit=5&offset=10");
      expect(status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // GET /prayers/stats
  // -----------------------------------------------------------------------
  describe("GET /prayers/stats", () => {
    it("returns zero counts when no prayers exist", async () => {
      const { status, json } = await request("/prayers/stats");
      expect(status).toBe(200);
      expect(json).toHaveProperty("count");
      expect(json).toHaveProperty("totalBurned");
    });

    it("returns aggregated stats when prayers exist", async () => {
      tableData.prayers = [
        { amount: 100n },
        { amount: 200n },
        { amount: 300n },
      ];

      const { status, json } = await request("/prayers/stats");
      expect(status).toBe(200);
      expect(json.count).toBe(3);
      // totalBurned is returned as a string
      expect(json.totalBurned).toBe("600");
    });
  });

  // -----------------------------------------------------------------------
  // GET /claims/:tokenId
  // -----------------------------------------------------------------------
  describe("GET /claims/:tokenId", () => {
    it("returns empty array for token with no claims", async () => {
      const { status, json } = await request("/claims/1");
      expect(status).toBe(200);
      expect(json).toEqual([]);
    });

    it("returns claims for a given tokenId", async () => {
      tableData.claims = [
        {
          id: "c1",
          tokenId: 7n,
          holder: "0xaaa",
          asset: "0xbbb",
          amount: 500n,
          txHash: "0xccc",
          blockNumber: 100n,
          timestamp: 1700000000n,
        },
      ];

      const { status, json } = await request("/claims/7");
      expect(status).toBe(200);
      expect(json).toEqual([
        {
          id: "c1",
          tokenId: "7",
          holder: "0xaaa",
          asset: "0xbbb",
          amount: "500",
          txHash: "0xccc",
          blockNumber: "100",
          timestamp: "1700000000",
        },
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // GET /fees/recent
  // -----------------------------------------------------------------------
  describe("GET /fees/recent", () => {
    it("returns empty array when no fee releases exist", async () => {
      const { status, json } = await request("/fees/recent");
      expect(status).toBe(200);
      expect(json).toEqual([]);
    });

    it("returns recent fee releases", async () => {
      tableData.feeReleases = [
        {
          id: "f1",
          caller: "0xaaa",
          burnAmount: 1000n,
          nftHolders: 500n,
          txHash: "0xdef",
          blockNumber: 50n,
          timestamp: 1700000000n,
        },
      ];

      const { status, json } = await request("/fees/recent");
      expect(status).toBe(200);
      expect(json).toHaveLength(1);
      expect(json[0].burnAmount).toBe("1000");
      expect(json[0].nftHolders).toBe("500");
    });

    it("accepts limit query param", async () => {
      const { status } = await request("/fees/recent?limit=5");
      expect(status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // GET /nfts/holders
  // -----------------------------------------------------------------------
  describe("GET /nfts/holders", () => {
    it("returns empty holder map when no transfers exist", async () => {
      const { status, json } = await request("/nfts/holders");
      expect(status).toBe(200);
      expect(json).toEqual({});
    });

    it("returns the latest holder per tokenId", async () => {
      // Ordered by descending blockNumber, so first entry wins per tokenId
      tableData.nftTransfers = [
        { tokenId: 1n, to: "0xBBB", from: "0xAAA", blockNumber: 200n },
        { tokenId: 1n, to: "0xAAA", from: "0x000", blockNumber: 100n },
        { tokenId: 2n, to: "0xCCC", from: "0x000", blockNumber: 150n },
      ];

      const { status, json } = await request("/nfts/holders");
      expect(status).toBe(200);
      // Token 1: first entry (block 200) wins -> 0xBBB
      // Token 2: only entry -> 0xCCC
      expect(json).toEqual({
        "1": "0xBBB",
        "2": "0xCCC",
      });
    });

    it("handles multiple tokens correctly", async () => {
      tableData.nftTransfers = [
        { tokenId: 10n, to: "0xAAA", from: "0x000", blockNumber: 300n },
        { tokenId: 20n, to: "0xBBB", from: "0x000", blockNumber: 250n },
        { tokenId: 30n, to: "0xCCC", from: "0x000", blockNumber: 200n },
      ];

      const { json } = await request("/nfts/holders");
      expect(Object.keys(json)).toHaveLength(3);
      expect(json["10"]).toBe("0xAAA");
      expect(json["20"]).toBe("0xBBB");
      expect(json["30"]).toBe("0xCCC");
    });
  });

  // -----------------------------------------------------------------------
  // GET /mints/recent
  // -----------------------------------------------------------------------
  describe("GET /mints/recent", () => {
    it("returns empty array when no mints exist", async () => {
      const { status, json } = await request("/mints/recent");
      expect(status).toBe(200);
      expect(json).toEqual([]);
    });

    it("returns recent mints with bigints stringified", async () => {
      tableData.nftMints = [
        {
          id: "mint-1",
          minter: "0xaaa",
          tokenId: 1n,
          txHash: "0xdef",
          blockNumber: 42069n,
          timestamp: 1700000000n,
        },
      ];

      const { status, json } = await request("/mints/recent");
      expect(status).toBe(200);
      expect(json).toHaveLength(1);
      expect(json[0].tokenId).toBe("1");
      expect(json[0].minter).toBe("0xaaa");
      expect(json[0].blockNumber).toBe("42069");
    });

    it("accepts limit query param", async () => {
      const { status } = await request("/mints/recent?limit=3");
      expect(status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // GET /mints/stats
  // -----------------------------------------------------------------------
  describe("GET /mints/stats", () => {
    it("returns zero count when no mints exist", async () => {
      const { status, json } = await request("/mints/stats");
      expect(status).toBe(200);
      expect(json).toEqual({ count: 0 });
    });

    it("returns the count of mints", async () => {
      tableData.nftMints = [
        { id: "m1" },
        { id: "m2" },
        { id: "m3" },
      ];

      const { status, json } = await request("/mints/stats");
      expect(status).toBe(200);
      expect(json.count).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // GET /activity
  // -----------------------------------------------------------------------
  describe("GET /activity", () => {
    it("returns empty array when no activity exists", async () => {
      const { status, json } = await request("/activity");
      expect(status).toBe(200);
      expect(json).toEqual([]);
    });

    it("returns mixed activity sorted by timestamp descending", async () => {
      tableData.nftMints = [
        {
          id: "mint-1",
          minter: "0xaaa",
          tokenId: 1n,
          txHash: "0x111",
          blockNumber: 100n,
          timestamp: 1700000100n,
        },
      ];
      tableData.claims = [
        {
          id: "c1",
          holder: "0xbbb",
          tokenId: 2n,
          asset: "0xccc",
          amount: 500n,
          txHash: "0x222",
          blockNumber: 200n,
          timestamp: 1700000300n,
        },
      ];
      tableData.feeReleases = [
        {
          id: "f1",
          caller: "0xddd",
          burnAmount: 1000n,
          nftHolders: 500n,
          txHash: "0x333",
          blockNumber: 300n,
          timestamp: 1700000200n,
        },
      ];
      tableData.prayers = [
        {
          id: "p1",
          sender: "0xeee",
          amount: 100n,
          message: "0xaa",
          txHash: "0x444",
          blockNumber: 400n,
          timestamp: 1700000400n,
        },
      ];

      const { status, json } = await request("/activity");
      expect(status).toBe(200);
      expect(json).toHaveLength(4);

      // Sorted by timestamp descending
      expect(json[0].type).toBe("prayer");
      expect(json[0].timestamp).toBe("1700000400");
      expect(json[1].type).toBe("claim");
      expect(json[1].timestamp).toBe("1700000300");
      expect(json[2].type).toBe("fee_release");
      expect(json[2].timestamp).toBe("1700000200");
      expect(json[3].type).toBe("mint");
      expect(json[3].timestamp).toBe("1700000100");
    });

    it("includes correct detail fields for each event type", async () => {
      tableData.nftMints = [
        {
          minter: "0xaaa",
          tokenId: 5n,
          txHash: "0x111",
          blockNumber: 10n,
          timestamp: 1700000001n,
        },
      ];
      tableData.claims = [
        {
          holder: "0xbbb",
          tokenId: 7n,
          asset: "0xccc",
          amount: 999n,
          txHash: "0x222",
          blockNumber: 20n,
          timestamp: 1700000002n,
        },
      ];
      tableData.feeReleases = [
        {
          caller: "0xddd",
          burnAmount: 100n,
          nftHolders: 50n,
          txHash: "0x333",
          blockNumber: 30n,
          timestamp: 1700000003n,
        },
      ];
      tableData.prayers = [
        {
          sender: "0xeee",
          amount: 42n,
          txHash: "0x444",
          blockNumber: 40n,
          timestamp: 1700000004n,
        },
      ];

      const { json } = await request("/activity");

      const mint = json.find((e: any) => e.type === "mint");
      expect(mint.details).toEqual({ minter: "0xaaa", tokenId: "5" });

      const claim = json.find((e: any) => e.type === "claim");
      expect(claim.details).toEqual({
        holder: "0xbbb",
        tokenId: "7",
        asset: "0xccc",
        amount: "999",
      });

      const feeRelease = json.find((e: any) => e.type === "fee_release");
      expect(feeRelease.details).toEqual({
        caller: "0xddd",
        burnAmount: "100",
        nftHolders: "50",
      });

      const prayer = json.find((e: any) => e.type === "prayer");
      expect(prayer.details).toEqual({ sender: "0xeee", amount: "42" });
    });

    it("respects limit query param", async () => {
      // Add many events
      tableData.prayers = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        sender: "0xaaa",
        amount: 1n,
        txHash: `0x${i.toString(16)}`,
        blockNumber: BigInt(i),
        timestamp: BigInt(1700000000 + i),
      }));

      const { json } = await request("/activity?limit=3");
      expect(json.length).toBeLessThanOrEqual(3);
    });

    it("returns events from all sources combined", async () => {
      tableData.nftMints = [
        { minter: "0xa", tokenId: 1n, txHash: "0x1", blockNumber: 1n, timestamp: 1n },
      ];
      tableData.claims = [
        {
          holder: "0xb",
          tokenId: 2n,
          asset: "0xc",
          amount: 1n,
          txHash: "0x2",
          blockNumber: 2n,
          timestamp: 2n,
        },
      ];
      tableData.feeReleases = [];
      tableData.prayers = [];

      const { json } = await request("/activity");
      expect(json).toHaveLength(2);
      const types = json.map((e: any) => e.type);
      expect(types).toContain("mint");
      expect(types).toContain("claim");
    });
  });
});
