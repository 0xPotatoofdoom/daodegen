import { ponder } from "ponder:registry";
import { toHex } from "viem";
import {
  feeReleases,
  claims,
  nftTransfers,
  nftMints,
  agents,
  prayers,
} from "ponder:schema";

ponder.on("DaoDeGenJar:FeesReleased", async ({ event, context }) => {
  await context.db.insert(feeReleases).values({
    id: event.id,
    caller: event.args.caller,
    burnAmount: event.args.burnAmount,
    nftHolders: event.args.nftHolders,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });
});

ponder.on("DaoDeGenJar:Claimed", async ({ event, context }) => {
  await context.db.insert(claims).values({
    id: event.id,
    tokenId: event.args.tokenId,
    holder: event.args.holder,
    asset: event.args.asset,
    amount: event.args.amount,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });
});

ponder.on("VerseNFT:Transfer", async ({ event, context }) => {
  await context.db.insert(nftTransfers).values({
    id: event.id,
    from: event.args.from,
    to: event.args.to,
    tokenId: event.args.tokenId,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });

  // Track mints (from == zero address)
  if (event.args.from === "0x0000000000000000000000000000000000000000") {
    await context.db.insert(nftMints).values({
      id: `mint-${event.id}`,
      minter: event.args.to,
      tokenId: event.args.tokenId,
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
    });
  }
});

ponder.on("AgentRegistry:AgentRegistered", async ({ event, context }) => {
  await context.db
    .insert(agents)
    .values({
      id: event.args.agentAddress,
      agentAddress: event.args.agentAddress,
      agentId: event.args.agentId,
      metadataURI: event.args.metadataURI,
      registeredAt: event.block.timestamp,
      revokedAt: null,
    })
    .onConflictDoUpdate({
      agentId: event.args.agentId,
      metadataURI: event.args.metadataURI,
      registeredAt: event.block.timestamp,
      revokedAt: null,
    });
});

ponder.on("AgentRegistry:AgentRevoked", async ({ event, context }) => {
  await context.db
    .update(agents, { id: event.args.agentAddress })
    .set({ revokedAt: event.block.timestamp });
});

ponder.on("PrayerBurn:Prayer", async ({ event, context }) => {
  await context.db.insert(prayers).values({
    id: event.id,
    sender: event.args.sender,
    amount: event.args.amount,
    message: toHex(event.args.message),
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });
});
