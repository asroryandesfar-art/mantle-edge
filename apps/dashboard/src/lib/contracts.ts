import { TARGET_CHAIN } from "./wallet"

export interface DeployedContract {
  name: string
  address: string
  description: string
}

/**
 * Smart contracts deployed to Mantle Sepolia testnet (chainId 5003).
 * Source of truth: packages/contracts/deployments/mantleSepolia.json
 */
export const DEPLOYED_CONTRACTS: DeployedContract[] = [
  {
    name: "AgentIdentityRegistry",
    address: "0x6EA3EA91896CBA417570F58B25f44ec4BE004ea1",
    description: "ERC-8004-inspired multi-agent identity registry",
  },
  {
    name: "AgentIdentityNFT",
    address: "0xE355E725c60eea454a9ba47dD57e65A5650cb119",
    description: "On-chain ERC-721 identity for this trading agent",
  },
  {
    name: "TradeLogger",
    address: "0x1Ef136f9dd6eA3A9f13Fb840854Ee3F5a2976628",
    description: "On-chain decision & execution audit log",
  },
  {
    name: "LogRegistry",
    address: "0xeB4848E15DaE5881300479f9BF057DbAf86F4D4b",
    description: "Lightweight on-chain action log (live audit trail)",
  },
]

/** Builds an explorer "address" page URL for the configured Mantle network. */
export function explorerAddressUrl(address: string): string {
  const base = process.env.NEXT_PUBLIC_EXPLORER || TARGET_CHAIN.explorerUrl
  return `${base}/address/${address}`
}
