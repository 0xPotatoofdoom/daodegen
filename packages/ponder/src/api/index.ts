import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { and, count, desc, eq, sum, graphql, replaceBigInts } from "ponder";

const app = new Hono();

// GraphQL endpoint (auto-generated from schema)
app.use("/graphql", graphql({ db, schema }));

// GET /prayers -- recent prayers, paginated
app.get("/prayers", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const offset = Number(c.req.query("offset") ?? 0);

  const result = await db
    .select()
    .from(schema.prayers)
    .orderBy(desc(schema.prayers.timestamp))
    .limit(limit)
    .offset(offset);

  return c.json(replaceBigInts(result, (b) => String(b)));
});

// GET /prayers/stats -- count + total burned
app.get("/prayers/stats", async (c) => {
  const result = await db
    .select({
      count: count(),
      totalBurned: sum(schema.prayers.amount),
    })
    .from(schema.prayers);

  const stats = result[0];
  return c.json({
    count: stats?.count ?? 0,
    totalBurned: stats?.totalBurned ? String(stats.totalBurned) : "0",
  });
});

// GET /prayers/tx/:txHash -- look up a prayer by transaction hash
app.get("/prayers/tx/:txHash", async (c) => {
  const txHash = c.req.param("txHash").toLowerCase() as `0x${string}`;
  const sender = c.req.query("sender")?.toLowerCase() as `0x${string}` | undefined;

  const conditions = [eq(schema.prayers.txHash, txHash)];
  if (sender) {
    conditions.push(eq(schema.prayers.sender, sender));
  }

  const result = await db
    .select()
    .from(schema.prayers)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Prayer not found" }, 404);
  }

  return c.json(replaceBigInts(result[0], (b) => String(b)));
});

// GET /claims/:tokenId -- claims for an NFT
app.get("/claims/:tokenId", async (c) => {
  const raw = c.req.param("tokenId");
  if (!/^\d+$/.test(raw)) {
    return c.json(
      { error: "Invalid tokenId — must be a non-negative integer" },
      400,
    );
  }
  const tokenId = BigInt(raw);

  const result = await db
    .select()
    .from(schema.claims)
    .where(eq(schema.claims.tokenId, tokenId))
    .orderBy(desc(schema.claims.timestamp));

  return c.json(replaceBigInts(result, (b) => String(b)));
});

// GET /fees/recent -- recent fee releases
app.get("/fees/recent", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);

  const result = await db
    .select()
    .from(schema.feeReleases)
    .orderBy(desc(schema.feeReleases.timestamp))
    .limit(limit);

  return c.json(replaceBigInts(result, (b) => String(b)));
});

// GET /nfts/holders -- current NFT holder map (latest Transfer per tokenId)
// Optimized: uses SQL subquery to get only the latest transfer per tokenId
// instead of fetching all transfers and deduplicating in JS
app.get("/nfts/holders", async (c) => {
  // Get distinct tokenIds first, then find the latest transfer for each
  // This avoids loading the entire nftTransfers table into memory
  const allTokenIds = await db
    .selectDistinct({ tokenId: schema.nftTransfers.tokenId })
    .from(schema.nftTransfers);

  const holders: Record<string, string> = {};

  // Batch lookup — one query per tokenId (bounded by NFT supply, max 81)
  for (const { tokenId } of allTokenIds) {
    const latest = await db
      .select({ to: schema.nftTransfers.to })
      .from(schema.nftTransfers)
      .where(eq(schema.nftTransfers.tokenId, tokenId))
      .orderBy(desc(schema.nftTransfers.blockNumber))
      .limit(1);

    if (latest[0]) {
      holders[String(tokenId)] = latest[0].to;
    }
  }

  return c.json(holders);
});

// GET /mints/recent -- recent NFT mints
app.get("/mints/recent", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);

  const result = await db
    .select()
    .from(schema.nftMints)
    .orderBy(desc(schema.nftMints.timestamp))
    .limit(limit);

  return c.json(replaceBigInts(result, (b) => String(b)));
});

// GET /mints/stats -- mint count
app.get("/mints/stats", async (c) => {
  const result = await db
    .select({ count: count() })
    .from(schema.nftMints);

  return c.json({ count: result[0]?.count ?? 0 });
});

// GET /activity -- unified audit log (most recent events across all tables)
app.get("/activity", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);

  const [mints, claims, fees, prayers] = await Promise.all([
    db
      .select()
      .from(schema.nftMints)
      .orderBy(desc(schema.nftMints.timestamp))
      .limit(limit),
    db
      .select()
      .from(schema.claims)
      .orderBy(desc(schema.claims.timestamp))
      .limit(limit),
    db
      .select()
      .from(schema.feeReleases)
      .orderBy(desc(schema.feeReleases.timestamp))
      .limit(limit),
    db
      .select()
      .from(schema.prayers)
      .orderBy(desc(schema.prayers.timestamp))
      .limit(limit),
  ]);

  type ActivityEvent = {
    type: string;
    timestamp: string;
    txHash: string;
    blockNumber: string;
    details: Record<string, string>;
  };

  const events: ActivityEvent[] = [];

  for (const m of mints) {
    events.push({
      type: "mint",
      timestamp: String(m.timestamp),
      txHash: m.txHash,
      blockNumber: String(m.blockNumber),
      details: { minter: m.minter, tokenId: String(m.tokenId) },
    });
  }

  for (const cl of claims) {
    events.push({
      type: "claim",
      timestamp: String(cl.timestamp),
      txHash: cl.txHash,
      blockNumber: String(cl.blockNumber),
      details: {
        holder: cl.holder,
        tokenId: String(cl.tokenId),
        asset: cl.asset,
        amount: String(cl.amount),
      },
    });
  }

  for (const f of fees) {
    events.push({
      type: "fee_release",
      timestamp: String(f.timestamp),
      txHash: f.txHash,
      blockNumber: String(f.blockNumber),
      details: {
        caller: f.caller,
        burnAmount: String(f.burnAmount),
        nftHolders: String(f.nftHolders),
      },
    });
  }

  for (const p of prayers) {
    events.push({
      type: "prayer",
      timestamp: String(p.timestamp),
      txHash: p.txHash,
      blockNumber: String(p.blockNumber),
      details: { sender: p.sender, amount: String(p.amount) },
    });
  }

  // Sort by timestamp descending, take limit
  events.sort((a, b) => Number(BigInt(b.timestamp) - BigInt(a.timestamp)));

  return c.json(events.slice(0, limit));
});

export default app;
