const hre = require("hardhat");

async function main() {
  const ContractFactory = await hre.ethers.getContractFactory("IntelliVaultStaker");
  const contract = await ContractFactory.deploy(); // Deploy the contract
  await contract.waitForDeployment();              // Wait for deployment (Hardhat v2.17+)
  const address = await contract.getAddress();     // Get contract address

  console.log("IntelliVaultStaker deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});