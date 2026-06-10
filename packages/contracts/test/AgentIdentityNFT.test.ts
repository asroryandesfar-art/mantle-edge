import { expect } from "chai";
import { ethers } from "hardhat";
import { anyUint } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { BaseContract, ContractTransactionResponse, Signer } from "ethers";

interface AgentIdentityNFTContract extends BaseContract {
  AGENT_TOKEN_ID(): Promise<bigint>;
  agentName(): Promise<string>;
  deployedAt(): Promise<bigint>;
  totalTrades(): Promise<bigint>;
  totalPnL(): Promise<bigint>;
  ownerOf(tokenId: bigint): Promise<string>;
  owner(): Promise<string>;
  updateStats(tokenId: bigint, pnl: bigint, tradeCount: bigint): Promise<ContractTransactionResponse>;
  transferFrom(from: string, to: string, tokenId: bigint): Promise<ContractTransactionResponse>;
  connect(signer: Signer): AgentIdentityNFTContract;
}

async function deployAgentIdentityNFT() {
  const [deployer, other] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("AgentIdentityNFT");
  const nft = (await factory.deploy("MantleEdge Multi-Agent")) as unknown as AgentIdentityNFTContract;
  await nft.waitForDeployment();
  return { nft, deployer: deployer!, other: other! };
}

describe("AgentIdentityNFT", () => {
  it("mints a single agent identity to the deployer on construction", async () => {
    const { nft, deployer } = await deployAgentIdentityNFT();

    const tokenId = await nft.AGENT_TOKEN_ID();
    expect(tokenId).to.equal(1n);
    expect(await nft.ownerOf(tokenId)).to.equal(deployer.address);
    expect(await nft.owner()).to.equal(deployer.address);
    expect(await nft.agentName()).to.equal("MantleEdge Multi-Agent");
    expect(await nft.totalTrades()).to.equal(0n);
    expect(await nft.totalPnL()).to.equal(0n);
    expect(await nft.deployedAt()).to.be.greaterThan(0n);
  });

  it("allows the owner to update agent stats", async () => {
    const { nft } = await deployAgentIdentityNFT();

    await expect(nft.updateStats(1n, 1_500_000n, 42n))
      .to.emit(nft, "AgentStatUpdated")
      .withArgs(1n, 1_500_000n, 42n, anyUint);

    expect(await nft.totalPnL()).to.equal(1_500_000n);
    expect(await nft.totalTrades()).to.equal(42n);
  });

  it("rejects stat updates from non-owners", async () => {
    const { nft, other } = await deployAgentIdentityNFT();

    await expect(nft.connect(other).updateStats(1n, 0n, 1n)).to.be.revertedWithCustomError(nft, "UnauthorizedStatsUpdater");
  });

  it("allows the current NFT owner to update stats after a transfer", async () => {
    const { nft, deployer, other } = await deployAgentIdentityNFT();

    await nft.transferFrom(deployer.address, other.address, 1n);

    await expect(nft.connect(other).updateStats(1n, 500_000n, 1n))
      .to.emit(nft, "AgentStatUpdated")
      .withArgs(1n, 500_000n, 1n, anyUint);
    await expect(nft.updateStats(1n, 600_000n, 2n)).to.be.revertedWithCustomError(
      nft,
      "UnauthorizedStatsUpdater",
    );
  });

  it("rejects stale or conflicting stat updates", async () => {
    const { nft } = await deployAgentIdentityNFT();

    await nft.updateStats(1n, 1_500_000n, 42n);

    await expect(nft.updateStats(1n, 1_000_000n, 41n)).to.be.revertedWithCustomError(nft, "StaleStatsUpdate");
    await expect(nft.updateStats(1n, 1_000_000n, 42n)).to.be.revertedWithCustomError(
      nft,
      "ConflictingStatsUpdate",
    );
  });

  it("rejects an invalid token ID", async () => {
    const { nft } = await deployAgentIdentityNFT();

    await expect(nft.updateStats(2n, 0n, 1n)).to.be.revertedWithCustomError(nft, "InvalidAgentTokenId");
  });
});
