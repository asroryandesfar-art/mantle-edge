import * as fs from "fs";
import * as path from "path";
import { ethers, network } from "hardhat";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account configured (set AGENT_PRIVATE_KEY)");

  const agentName = process.env.AGENT_NAME ?? "MantleEdge Multi-Agent";

  console.log(`Deploying all contracts from ${deployer.address} on ${network.name}...`);

  const identityRegistryFactory = await ethers.getContractFactory("AgentIdentityRegistry");
  const identityRegistry = await identityRegistryFactory.deploy();
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();
  console.log(`AgentIdentityRegistry deployed to: ${identityRegistryAddress}`);

  const logRegistryFactory = await ethers.getContractFactory("LogRegistry");
  const logRegistry = await logRegistryFactory.deploy();
  await logRegistry.waitForDeployment();
  const logRegistryAddress = await logRegistry.getAddress();
  console.log(`LogRegistry deployed to: ${logRegistryAddress}`);

  const nftFactory = await ethers.getContractFactory("AgentIdentityNFT");
  const nft = await nftFactory.deploy(agentName);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log(`AgentIdentityNFT deployed to: ${nftAddress}`);

  const loggerFactory = await ethers.getContractFactory("TradeLogger");
  const logger = await loggerFactory.deploy();
  await logger.waitForDeployment();
  const loggerAddress = await logger.getAddress();
  console.log(`TradeLogger deployed to: ${loggerAddress}`);

  const chainId = (await ethers.provider.getNetwork()).chainId;

  const deploymentInfo = {
    network: network.name,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      AgentIdentityRegistry: {
        address: identityRegistryAddress,
      },
      LogRegistry: {
        address: logRegistryAddress,
      },
      AgentIdentityNFT: {
        address: nftAddress,
        agentName,
      },
      TradeLogger: {
        address: loggerAddress,
      },
    },
  };

  const deploymentsDir = path.resolve(__dirname, "../deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const outputPath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(deploymentInfo, null, 2)}\n`);
  console.log(`Deployment info written to: ${outputPath}`);

  console.log("\nSet these in your .env file:");
  console.log(`AGENT_IDENTITY_REGISTRY_ADDRESS=${identityRegistryAddress}`);
  console.log(`LOG_REGISTRY_ADDRESS=${logRegistryAddress}`);
  console.log(`AGENT_IDENTITY_NFT_ADDRESS=${nftAddress}`);
  console.log(`TRADE_LOGGER_ADDRESS=${loggerAddress}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
