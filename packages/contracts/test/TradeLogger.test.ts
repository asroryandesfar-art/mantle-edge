import { expect } from "chai";
import { ethers } from "hardhat";
import { anyUint } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { BaseContract, ContractTransactionResponse, EventLog, Signer } from "ethers";

interface TradeLoggerContract extends BaseContract {
  logDecision(
    asset: string,
    direction: string,
    confidence: bigint,
    reasoning: string,
  ): Promise<ContractTransactionResponse>;
  logExecution(asset: string, amount: bigint, price: bigint, success: boolean): Promise<ContractTransactionResponse>;
  connect(signer: Signer): TradeLoggerContract;
}

async function deployTradeLogger() {
  const [agent, other] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("TradeLogger");
  const logger = (await factory.deploy()) as unknown as TradeLoggerContract;
  await logger.waitForDeployment();
  return { logger, agent: agent!, other: other! };
}

describe("TradeLogger", () => {
  it("emits DecisionLogged with the caller as the agent", async () => {
    const { logger, agent } = await deployTradeLogger();

    await expect(logger.logDecision("MNT/USDT", "LONG", 88n, "EMA20 above EMA50, RSI neutral"))
      .to.emit(logger, "DecisionLogged")
      .withArgs(
        agent.address,
        ethers.id("MNT/USDT"),
        "MNT/USDT",
        "LONG",
        88n,
        "EMA20 above EMA50, RSI neutral",
        anyUint,
      );
  });

  it("emits ExecutionLogged with the caller as the agent", async () => {
    const { logger, agent } = await deployTradeLogger();

    await expect(logger.logExecution("MNT/USDT", 25_000_000n, 850_000n, true))
      .to.emit(logger, "ExecutionLogged")
      .withArgs(agent.address, ethers.id("MNT/USDT"), true, "MNT/USDT", 25_000_000n, 850_000n, anyUint);
  });

  it("allows filtering ExecutionLogged events by the indexed `success` flag", async () => {
    const { logger, agent } = await deployTradeLogger();

    await logger.logExecution("BTC/USDT", 10_000_000n, 60_000_000_000n, true);
    await logger.logExecution("ETH/USDT", 5_000_000n, 3_000_000_000n, false);

    const successFilter = logger.filters.ExecutionLogged(agent.address, undefined, true);
    const successEvents = (await logger.queryFilter(successFilter)) as EventLog[];

    expect(successEvents).to.have.lengthOf(1);
    expect(successEvents[0]?.args.asset).to.equal("BTC/USDT");
    expect(successEvents[0]?.args.amount).to.equal(10_000_000n);
  });

  it("allows filtering by asset hash while retaining the readable asset", async () => {
    const { logger, agent } = await deployTradeLogger();

    await logger.logDecision("MNT/USDT", "LONG", 88n, "Momentum confirmed");
    await logger.logDecision("ETH/USDT", "WAIT", 55n, "No setup");

    const filter = logger.filters.DecisionLogged(agent.address, ethers.id("MNT/USDT"));
    const events = (await logger.queryFilter(filter)) as EventLog[];

    expect(events).to.have.lengthOf(1);
    expect(events[0]?.args.asset).to.equal("MNT/USDT");
  });

  it("rejects logs from non-owners", async () => {
    const { logger, other } = await deployTradeLogger();

    await expect(logger.connect(other).logDecision("MNT/USDT", "LONG", 88n, "spoofed"))
      .to.be.revertedWithCustomError(logger, "OwnableUnauthorizedAccount");
    await expect(logger.connect(other).logExecution("MNT/USDT", 1n, 1n, true))
      .to.be.revertedWithCustomError(logger, "OwnableUnauthorizedAccount");
  });
});
