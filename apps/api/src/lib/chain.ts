import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import { config } from "../config.js";

const REFRESH_INTERVAL_MS = 60_000;

const AGENT_IDENTITY_NFT_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function deployedAt() view returns (uint256)",
];

const AGENT_TOKEN_ID = 1n;

export interface ChainSnapshot {
  gasPrice: string;
  agentAddress: string;
  network: string;
  identity: { tokenId: string; owner: string; birthBlock: string } | null;
}

const snapshot: ChainSnapshot = {
  gasPrice: "n/a",
  agentAddress: config.agentAddress,
  network: config.mantleNetworkName,
  identity: null,
};

const provider = new JsonRpcProvider(config.mantleRpcUrl);

async function refresh(): Promise<void> {
  try {
    const feeData = await provider.getFeeData();
    if (feeData.gasPrice !== null) {
      snapshot.gasPrice = `${Number(formatUnits(feeData.gasPrice, "gwei")).toFixed(3)} Gwei`;
    }
  } catch (err) {
    console.error(`[chain] failed to fetch gas price: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (config.agentIdentityNftAddress) {
    try {
      const nft = new Contract(config.agentIdentityNftAddress, AGENT_IDENTITY_NFT_ABI, provider);
      const [owner, deployedAt] = await Promise.all([
        nft.ownerOf(AGENT_TOKEN_ID) as Promise<string>,
        nft.deployedAt() as Promise<bigint>,
      ]);
      snapshot.identity = {
        tokenId: AGENT_TOKEN_ID.toString(),
        owner,
        birthBlock: new Date(Number(deployedAt) * 1000).toISOString(),
      };
    } catch (err) {
      console.error(`[chain] failed to read AgentIdentityNFT: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

void refresh();
setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

/** Returns the most recently fetched on-chain snapshot (gas price, agent identity). */
export function getChainSnapshot(): ChainSnapshot {
  return snapshot;
}
