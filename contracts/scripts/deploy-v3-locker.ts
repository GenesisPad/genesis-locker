import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys GenesisV3PositionLocker + GenesisLockerRegistry. Testnet/local only - refuses to
 * run against any network whose name doesn't explicitly opt in, per Requirement 3's
 * "Do not deploy to production mainnet" restriction. Wires the two contracts together and
 * writes a JSON manifest that contracts/script/deployDirectV3Stack.js reads to configure
 * GenesisProtocolConfig with the locker's address (cross-repo deployment coordination -
 * see docs/DEPLOYMENT.md).
 */
const ALLOWED_NETWORKS = ["hardhat", "localhost", "robinhoodTestnet"];

async function main() {
  if (!ALLOWED_NETWORKS.includes(network.name)) {
    throw new Error(
      `Refusing to deploy GenesisV3PositionLocker to network "${network.name}" - only ${ALLOWED_NETWORKS.join(", ")} are permitted this milestone (no mainnet deploys, per Requirement 3's explicit restriction).`,
    );
  }

  const [deployer] = await ethers.getSigners();
  const feeDistributionRegistry = process.env.FEE_DISTRIBUTION_REGISTRY_ADDRESS;
  if (!feeDistributionRegistry) {
    throw new Error("FEE_DISTRIBUTION_REGISTRY_ADDRESS is required so the locker can resolve the active fee distributor.");
  }
  console.log(`Deploying GenesisV3PositionLocker + GenesisLockerRegistry to "${network.name}" as ${deployer.address}`);

  const Locker = await ethers.getContractFactory("GenesisV3PositionLocker");
  const locker = await Locker.deploy(deployer.address, feeDistributionRegistry);
  await locker.waitForDeployment();
  const lockerAddress = await locker.getAddress();
  console.log(`GenesisV3PositionLocker: ${lockerAddress}`);

  const Registry = await ethers.getContractFactory("GenesisLockerRegistry");
  const lockerRegistry = await Registry.deploy(deployer.address);
  await lockerRegistry.waitForDeployment();
  const lockerRegistryAddress = await lockerRegistry.getAddress();
  console.log(`GenesisLockerRegistry: ${lockerRegistryAddress}`);

  await (await locker.setLockerRegistry(lockerRegistryAddress)).wait();
  await (await lockerRegistry.setAuthorizedLocker(lockerAddress, true)).wait();
  console.log("Wired locker <-> registry.");

  console.log(
    "\nNOTE: setApprovedPositionManager and setLaunchFactory still need to be called once the " +
      "main contracts/ stack (GenesisLaunchFactory, GenesisProtocolConfig's approved " +
      "position manager) is deployed - see contracts/script/deployDirectV3Stack.js's printed follow-up commands.",
  );

  const manifest = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    genesisV3PositionLocker: lockerAddress,
    genesisFeeDistributionRegistry: feeDistributionRegistry,
    genesisLockerRegistry: lockerRegistryAddress,
    deployedAt: new Date().toISOString(),
  };
  const outDir = path.join(__dirname, "..", "deployments", network.name);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "v3-locker-stack.json"), JSON.stringify(manifest, null, 2));
  console.log(`Manifest written to deployments/${network.name}/v3-locker-stack.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
