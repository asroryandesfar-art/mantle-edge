import { expect } from "chai";
import { ethers } from "hardhat";
import type { BaseContract, ContractTransactionResponse, Signer } from "ethers";

interface AgentIdentityRegistryContract extends BaseContract {
  register(agentAddress: string, agentURI: string): Promise<ContractTransactionResponse>;
  setAgentURI(agentId: bigint, agentURI: string): Promise<ContractTransactionResponse>;
  setAgentAddress(agentId: bigint, agentAddress: string): Promise<ContractTransactionResponse>;
  ownerOf(agentId: bigint): Promise<string>;
  agentAddress(agentId: bigint): Promise<string>;
  agentURI(agentId: bigint): Promise<string>;
  agentIdOf(wallet: string): Promise<bigint>;
  connect(signer: Signer): AgentIdentityRegistryContract;
}

async function deployRegistry() {
  const [owner, agentWallet, other] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("AgentIdentityRegistry");
  const registry = (await factory.deploy()) as unknown as AgentIdentityRegistryContract;
  await registry.waitForDeployment();
  return { registry, owner: owner!, agentWallet: agentWallet!, other: other! };
}

describe("AgentIdentityRegistry", () => {
  it("registers a new agent identity", async () => {
    const { registry, owner, agentWallet } = await deployRegistry();

    await expect(registry.register(agentWallet.address, "ipfs://agent-card.json"))
      .to.emit(registry, "AgentRegistered")
      .withArgs(1n, owner.address, agentWallet.address, "ipfs://agent-card.json");

    expect(await registry.ownerOf(1n)).to.equal(owner.address);
    expect(await registry.agentAddress(1n)).to.equal(agentWallet.address);
    expect(await registry.agentURI(1n)).to.equal("ipfs://agent-card.json");
    expect(await registry.agentIdOf(agentWallet.address)).to.equal(1n);
  });

  it("prevents registering the same agent address twice", async () => {
    const { registry, agentWallet } = await deployRegistry();
    await registry.register(agentWallet.address, "ipfs://a.json");

    await expect(registry.register(agentWallet.address, "ipfs://b.json")).to.be.revertedWithCustomError(
      registry,
      "AgentAddressAlreadyRegistered",
    );
  });

  it("only allows the owner to update the agent URI", async () => {
    const { registry, agentWallet, other } = await deployRegistry();
    await registry.register(agentWallet.address, "ipfs://a.json");

    await expect(registry.connect(other).setAgentURI(1n, "ipfs://b.json")).to.be.revertedWithCustomError(
      registry,
      "NotAgentOwner",
    );

    await registry.setAgentURI(1n, "ipfs://b.json");
    expect(await registry.agentURI(1n)).to.equal("ipfs://b.json");
  });

  it("allows the owner to re-key the agent address", async () => {
    const { registry, agentWallet, other } = await deployRegistry();
    await registry.register(agentWallet.address, "ipfs://a.json");

    await expect(registry.setAgentAddress(1n, other.address))
      .to.emit(registry, "AgentAddressUpdated")
      .withArgs(1n, other.address);

    expect(await registry.agentAddress(1n)).to.equal(other.address);
    expect(await registry.agentIdOf(other.address)).to.equal(1n);
    expect(await registry.agentIdOf(agentWallet.address)).to.equal(0n);
  });
});
