import { createConfig } from "ponder";
import { DaoDeGenJarAbi } from "./abis/DaoDeGenJar";
import { VerseNFTAbi } from "./abis/VerseNFT";
import { AgentRegistryAbi } from "./abis/AgentRegistry";
import { PrayerBurnAbi } from "./abis/PrayerBurn";

// Chain configuration -- set PONDER_CHAIN=mainnet for Unichain mainnet (130)
const isMainnet = process.env.PONDER_CHAIN === "mainnet";
const chainId = isMainnet ? 130 : 1301;
const chainName = isMainnet ? "unichain" : "unichainSepolia";
const defaultRpc = isMainnet
  ? "https://mainnet.unichain.org"
  : "https://sepolia.unichain.org";

// Contract addresses -- override with env vars for mainnet deployment
const addresses = {
  jar: process.env.PONDER_JAR_ADDRESS ?? "0xd25a5C67F180811e43990B2A0148Ac0d93ab9336",
  nft: process.env.PONDER_NFT_ADDRESS ?? "0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50",
  registry: process.env.PONDER_REGISTRY_ADDRESS ?? "0xBFE569F809b644703175Be603684Be0b7f6eee89",
  prayerBurn: process.env.PONDER_PRAYER_BURN_ADDRESS ?? "0x22A0EDaBF0a567C8eE646472607c25c9021920D6",
};

const startBlock = Number(process.env.PONDER_START_BLOCK ?? (isMainnet ? 42643600 : 44627676));
const prayerBurnStartBlock = Number(process.env.PONDER_PRAYER_BURN_START_BLOCK ?? (isMainnet ? 42643600 : 44933569));

export default createConfig({
  chains: {
    [chainName]: {
      id: chainId,
      rpc: process.env[`PONDER_RPC_URL_${chainId}`] ?? defaultRpc,
      maxRequestsPerSecond: 25,
    },
  },
  contracts: {
    DaoDeGenJar: {
      abi: DaoDeGenJarAbi,
      chain: chainName,
      address: addresses.jar as `0x${string}`,
      startBlock,
    },
    VerseNFT: {
      abi: VerseNFTAbi,
      chain: chainName,
      address: addresses.nft as `0x${string}`,
      startBlock,
    },
    AgentRegistry: {
      abi: AgentRegistryAbi,
      chain: chainName,
      address: addresses.registry as `0x${string}`,
      startBlock,
    },
    PrayerBurn: {
      abi: PrayerBurnAbi,
      chain: chainName,
      address: addresses.prayerBurn as `0x${string}`,
      startBlock: prayerBurnStartBlock,
    },
  },
});
