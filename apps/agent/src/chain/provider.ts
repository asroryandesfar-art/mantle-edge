import { JsonRpcProvider, Wallet } from "ethers";
import { config } from "../config.js";

/** Read-only JSON-RPC provider connected to the configured Mantle network. */
export const provider = new JsonRpcProvider(config.mantle.rpcUrl, config.mantle.chainId, {
  staticNetwork: true,
});

/** Wallet the agent uses to sign and submit transactions on Mantle. */
export const wallet = new Wallet(config.wallet.privateKey, provider);
