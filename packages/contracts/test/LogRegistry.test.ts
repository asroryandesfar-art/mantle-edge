import { expect } from "chai";
import { ethers } from "hardhat";
import { anyUint } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { BaseContract, ContractTransactionResponse } from "ethers";

interface LogRegistryContract extends BaseContract {
  logAction(
    action: string,
    asset: string,
    amount: bigint,
    price: bigint,
    note: string,
  ): Promise<ContractTransactionResponse>;
}

async function deployLogRegistry() {
  const [agent] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("LogRegistry");
  const registry = (await factory.deploy()) as unknown as LogRegistryContract;
  await registry.waitForDeployment();
  return { registry, agent: agent! };
}

describe("LogRegistry", () => {
  it("emits ActionLogged with the caller as the agent", async () => {
    const { registry, agent } = await deployLogRegistry();

    await expect(registry.logAction("OPEN", "MNT/USDT", 25_000_000n, 850_000n, "approved: 20% of equity"))
      .to.emit(registry, "ActionLogged")
      .withArgs(agent.address, "OPEN", "MNT/USDT", 25_000_000n, 850_000n, "approved: 20% of equity", anyUint);
  });
});
