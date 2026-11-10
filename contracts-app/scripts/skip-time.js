const hre = require("hardhat");

// Fast-forwards the LOCAL Hardhat chain clock so campaign deadlines pass.
// Default: 8 days. Override with the DAYS env variable.
async function main() {
  const days = Number(process.env.DAYS || 8);

  await hre.network.provider.send("evm_increaseTime", [days * 24 * 60 * 60]);
  await hre.network.provider.send("evm_mine");

  const block = await hre.ethers.provider.getBlock("latest");
  console.log(`Skipped ${days} day(s). Chain time is now: ${new Date(block.timestamp * 1000).toLocaleString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});