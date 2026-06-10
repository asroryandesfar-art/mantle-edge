import { Contract } from "ethers";
import { config } from "../config.js";
import { wallet } from "../chain/provider.js";
import { createLogger } from "../logger.js";

const logger = createLogger("multiagent:logRegistry");

/** ABI for the LogRegistry contract in `packages/contracts` (see LogRegistry.sol). */
const LOG_REGISTRY_ABI = [
  "function logAction(string action, string asset, int256 amount, int256 price, string note)",
  "event ActionLogged(address indexed agent, string action, string asset, int256 amount, int256 price, string note, uint256 timestamp)",
] as const;

/** Fixed-point scale used for `amount`/`price` arguments, matching LogRegistry.sol. */
const FIXED_POINT_SCALE = 1e6;

/** Client for emitting on-chain audit-trail events via a `LogRegistry` deployment. */
export class LogRegistryClient {
  private readonly registry: Contract | null;

  constructor(registryAddress: string | undefined = config.logRegistry.address) {
    this.registry = registryAddress ? new Contract(registryAddress, LOG_REGISTRY_ABI, wallet) : null;
  }

  /** Whether `LOG_REGISTRY_ADDRESS` is configured. */
  get isConfigured(): boolean {
    return this.registry !== null;
  }

  /**
   * Emits an `ActionLogged` event recording `action` on `asset`. Returns the
   * transaction hash, or null if no registry is configured or the call fails.
   * Never throws.
   */
  async logAction(action: string, asset: string, amount: number, price: number, note: string): Promise<string | null> {
    if (!this.registry) return null;

    try {
      const amountScaled = BigInt(Math.round(amount * FIXED_POINT_SCALE));
      const priceScaled = BigInt(Math.round(price * FIXED_POINT_SCALE));

      const tx = await this.registry.logAction(action, asset, amountScaled, priceScaled, note.slice(0, 256));
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error(`LogRegistry.logAction reverted: ${tx.hash}`);
      }

      return tx.hash as string;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn("on-chain action logging failed", { action, asset, error: message });
      return null;
    }
  }
}

export const logRegistry = new LogRegistryClient();
