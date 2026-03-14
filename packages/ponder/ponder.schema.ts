import { onchainTable, index } from "ponder";

export const prayers = onchainTable(
  "prayers",
  (t) => ({
    id: t.text().primaryKey(),
    sender: t.hex().notNull(),
    amount: t.bigint().notNull(),
    message: t.text().notNull(),
    txHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
  }),
  (table) => ({
    senderIdx: index("prayers_sender_idx").on(table.sender),
    timestampIdx: index("prayers_timestamp_idx").on(table.timestamp),
  }),
);

export const feeReleases = onchainTable(
  "fee_releases",
  (t) => ({
    id: t.text().primaryKey(),
    caller: t.hex().notNull(),
    burnAmount: t.bigint().notNull(),
    nftHolders: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
  }),
  (table) => ({
    timestampIdx: index("fee_releases_timestamp_idx").on(table.timestamp),
  }),
);

export const claims = onchainTable(
  "claims",
  (t) => ({
    id: t.text().primaryKey(),
    tokenId: t.bigint().notNull(),
    holder: t.hex().notNull(),
    asset: t.hex().notNull(),
    amount: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
  }),
  (table) => ({
    holderIdx: index("claims_holder_idx").on(table.holder),
    tokenIdIdx: index("claims_token_id_idx").on(table.tokenId),
  }),
);

export const nftTransfers = onchainTable(
  "nft_transfers",
  (t) => ({
    id: t.text().primaryKey(),
    from: t.hex().notNull(),
    to: t.hex().notNull(),
    tokenId: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
  }),
  (table) => ({
    tokenIdIdx: index("nft_transfers_token_id_idx").on(table.tokenId),
    toIdx: index("nft_transfers_to_idx").on(table.to),
  }),
);

export const nftMints = onchainTable(
  "nft_mints",
  (t) => ({
    id: t.text().primaryKey(),
    minter: t.hex().notNull(),
    tokenId: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
  }),
  (table) => ({
    minterIdx: index("nft_mints_minter_idx").on(table.minter),
    timestampIdx: index("nft_mints_timestamp_idx").on(table.timestamp),
  }),
);

export const agents = onchainTable(
  "agents",
  (t) => ({
    id: t.text().primaryKey(),
    agentAddress: t.hex().notNull(),
    agentId: t.bigint().notNull(),
    metadataURI: t.text().notNull(),
    registeredAt: t.bigint().notNull(),
    revokedAt: t.bigint(),
  }),
  (table) => ({
    addressIdx: index("agents_address_idx").on(table.agentAddress),
  }),
);
