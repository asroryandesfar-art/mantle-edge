import * as path from "node:path";
import * as dotenv from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import type { HardhatUserConfig } from "hardhat/config";

// Share the monorepo's root .env so AGENT_PRIVATE_KEY / MANTLE_RPC_URL only
// need to be configured once.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const rawKey = process.env.AGENT_PRIVATE_KEY;
const accounts = rawKey ? [rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // OpenZeppelin Contracts v5.1+ use the MCOPY opcode (Bytes.sol), which
      // requires targeting the Cancun EVM. Mantle (OP-stack) has supported
      // Cancun/Ecotone since March 2024.
      evmVersion: "cancun",
    },
  },
  networks: {
    mantle: {
      url: process.env.MANTLE_RPC_URL ?? "https://rpc.mantle.xyz",
      chainId: 5000,
      accounts,
    },
    mantleSepolia: {
      url: "https://rpc.sepolia.mantle.xyz",
      chainId: 5003,
      accounts,
    },
  },
};

export default config;
