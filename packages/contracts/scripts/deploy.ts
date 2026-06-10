import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account configured (set AGENT_PRIVATE_KEY)");

  console.log(`Deploying AgentIdentityRegistry from ${deployer.address}...`);

  const factory = await ethers.getContractFactory("AgentIdentityRegistry");
  const registry = await factory.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`AgentIdentityRegistry deployed to: ${address}`);
  console.log(`Set AGENT_IDENTITY_REGISTRY_ADDRESS=${address} in your .env file.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
