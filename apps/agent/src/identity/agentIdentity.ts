import { Contract, type EventLog, type Log, type LogDescription } from "ethers";
import type { AgentIdentity } from "@mantle-edge/shared";
import { config } from "../config.js";
import { wallet } from "../chain/provider.js";
import { createLogger } from "../logger.js";

const logger = createLogger("identity");

/**
 * ABI for the AgentIdentityRegistry contract in `packages/contracts`, an
 * ERC-8004-inspired ERC-721 identity registry for autonomous agents.
 */
const REGISTRY_ABI = [
  "function register(address agentAddress, string agentURI) returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string agentURI)",
  "function setAgentAddress(uint256 agentId, address agentAddress)",
  "function agentURI(uint256 agentId) view returns (string)",
  "function agentAddress(uint256 agentId) view returns (address)",
  "function ownerOf(uint256 agentId) view returns (address)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, address indexed agentAddress, string agentURI)",
] as const;

/**
 * Client for registering and looking up this agent's on-chain identity
 * against an `AgentIdentityRegistry` deployment (see `packages/contracts`).
 */
export class AgentIdentityClient {
  private readonly registry: Contract | null;

  constructor(private readonly registryAddress: string | undefined = config.identity.registryAddress) {
    this.registry = registryAddress ? new Contract(registryAddress, REGISTRY_ABI, wallet) : null;
  }

  /** Whether `AGENT_IDENTITY_REGISTRY_ADDRESS` is configured. */
  get isConfigured(): boolean {
    return this.registry !== null;
  }

  /**
   * Returns this agent's existing on-chain identity, or registers a new one
   * using `AGENT_METADATA_URI` if none exists yet. Returns null if no
   * registry is configured.
   */
  async ensureRegistered(metadataUri: string | undefined = config.identity.metadataUri): Promise<AgentIdentity | null> {
    if (!this.registry || !this.registryAddress) {
      logger.debug("identity registry not configured, skipping registration");
      return null;
    }

    const existing = await this.findByAgentAddress(wallet.address);
    if (existing) return existing;

    if (!metadataUri) {
      throw new Error("AGENT_METADATA_URI must be set to register a new agent identity");
    }

    const tx = await this.registry.register(wallet.address, metadataUri);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Agent identity registration reverted: ${tx.hash}`);
    }

    const event = receipt.logs
      .map((log: Log | EventLog): LogDescription | null => {
        try {
          return this.registry!.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: LogDescription | null) => parsed?.name === "AgentRegistered");

    const agentId = event ? (event.args.agentId as bigint).toString() : "0";

    logger.info("registered agent identity", { agentId, txHash: tx.hash });

    return {
      agentId,
      registry: this.registryAddress as `0x${string}`,
      chainId: config.mantle.chainId,
      owner: wallet.address as `0x${string}`,
      agentAddress: wallet.address as `0x${string}`,
      metadataURI: metadataUri,
      registeredAt: Date.now(),
    };
  }

  /** Looks up an existing identity whose operating wallet matches `address`. */
  async findByAgentAddress(address: string): Promise<AgentIdentity | null> {
    if (!this.registry || !this.registryAddress) return null;

    const filter = this.registry.filters.AgentRegistered(undefined, undefined, address);
    const events = (await this.registry.queryFilter(filter)) as EventLog[];
    const last = events.at(-1);
    if (!last) return null;

    const agentId = (last.args.agentId as bigint).toString();
    const [owner, metadataURI] = await Promise.all([
      this.registry.ownerOf(agentId) as Promise<string>,
      this.registry.agentURI(agentId) as Promise<string>,
    ]);

    return {
      agentId,
      registry: this.registryAddress as `0x${string}`,
      chainId: config.mantle.chainId,
      owner: owner as `0x${string}`,
      agentAddress: address as `0x${string}`,
      metadataURI,
      registeredAt: Date.now(),
    };
  }
}

export const agentIdentity = new AgentIdentityClient();
