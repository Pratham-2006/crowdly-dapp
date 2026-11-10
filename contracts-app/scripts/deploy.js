const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const Crowdfunding = await hre.ethers.getContractFactory("Crowdfunding");
  const cf = await Crowdfunding.deploy();
  await cf.waitForDeployment();

  const address = await cf.getAddress();
  const { chainId } = await hre.ethers.provider.getNetwork();
  console.log(`Crowdfunding deployed to: ${address} (${hre.network.name})`);

  // Export address + ABI so the React app can use them
  const outDir = path.join(__dirname, "..", "..", "frontend", "src", "contracts");
  fs.mkdirSync(outDir, { recursive: true });

  const artifact = await hre.artifacts.readArtifact("Crowdfunding");
  fs.writeFileSync(
    path.join(outDir, "Crowdfunding.json"),
    JSON.stringify({ address, chainId: Number(chainId), network: hre.network.name, abi: artifact.abi }, null, 2)
  );
  console.log("Address + ABI saved to frontend/src/contracts/Crowdfunding.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});