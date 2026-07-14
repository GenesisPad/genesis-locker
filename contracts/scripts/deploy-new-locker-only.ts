import { ethers, network } from "hardhat";

/**
 * Deploys a fresh GenesisV3PositionLocker only, reusing the existing shared
 * GenesisFeeDistributionRegistry and GenesisLockerRegistry (both mapping/list-based and safe to
 * reuse across locker generations - see docs/DEPLOYMENT.md). This locker's launchFactory binding
 * is one-way and the currently deployed locker is already bound to the old, buggy
 * GenesisLaunchFactory, so a fresh locker is required for the new factory - but nothing else in
 * the locker stack needs to move.
 *
 * Required env vars:
 *   FEE_DISTRIBUTION_REGISTRY_ADDRESS - existing shared fee distribution registry
 * Optional:
 *   OWNER_ADDRESS / FINAL_OWNER - printed for reference only; this script does NOT transfer
 *     ownership (deployer stays owner so it can finish wiring setApprovedPositionManager/
 *     setLockerRegistry/setLaunchFactory once the rest of the stack is deployed).
 */
const ALLOWED_NETWORKS = ["hardhat", "localhost", "robinhoodTestnet", "robinhood"];
const MAINNET_CONFIRMATION = "DEPLOY_GENESISPAD_V3_TO_ROBINHOOD_MAINNET";

async function main() {
  if (!ALLOWED_NETWORKS.includes(network.name)) {
    throw new Error(`Refusing to deploy to network "${network.name}".`);
  }
  if (network.name === "robinhood" && process.env.MAINNET_DEPLOY_CONFIRMATION !== MAINNET_CONFIRMATION) {
    throw new Error(`Set MAINNET_DEPLOY_CONFIRMATION=${MAINNET_CONFIRMATION} to deploy to Robinhood mainnet.`);
  }

  const feeDistributionRegistry = process.env.FEE_DISTRIBUTION_REGISTRY_ADDRESS;
  if (!feeDistributionRegistry) {
    throw new Error("FEE_DISTRIBUTION_REGISTRY_ADDRESS is required.");
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying GenesisV3PositionLocker to "${network.name}" as ${deployer.address}`);

  const Locker = await ethers.getContractFactory("GenesisV3PositionLocker");
  const locker = await Locker.deploy(deployer.address, feeDistributionRegistry);
  await locker.waitForDeployment();
  const lockerAddress = await locker.getAddress();
  console.log(`GenesisV3PositionLocker: ${lockerAddress}`);
  console.log("NEW_LOCKER_ADDRESS=" + lockerAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
