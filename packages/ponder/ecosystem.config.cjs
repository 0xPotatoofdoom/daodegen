require('dotenv').config({ path: __dirname + '/.env' });
// Load .env.local overrides (mainnet addresses, start block, chain)
require('dotenv').config({ path: __dirname + '/.env.local', override: true });

module.exports = {
  apps: [{
    name: 'ponder-indexer',
    script: 'npx',
    args: 'ponder start --schema v1',
    cwd: __dirname,
    interpreter: 'none',
    env: {
      PONDER_CHAIN: process.env.PONDER_CHAIN,
      PONDER_START_BLOCK: process.env.PONDER_START_BLOCK,
      PONDER_JAR_ADDRESS: process.env.PONDER_JAR_ADDRESS,
      PONDER_NFT_ADDRESS: process.env.PONDER_NFT_ADDRESS,
      PONDER_TOKEN_ADDRESS: process.env.PONDER_TOKEN_ADDRESS,
      PONDER_REGISTRY_ADDRESS: process.env.PONDER_REGISTRY_ADDRESS,
      PONDER_PRAYER_BURN_ADDRESS: process.env.PONDER_PRAYER_BURN_ADDRESS,
      PONDER_RPC_URL_130: process.env.PONDER_RPC_URL_130,
      PONDER_RPC_URL_1301: process.env.PONDER_RPC_URL_1301,
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_SCHEMA: process.env.DATABASE_SCHEMA,
    },
    out_file: __dirname + '/logs/ponder-out.log',
    error_file: __dirname + '/logs/ponder-error.log',
  }]
};
