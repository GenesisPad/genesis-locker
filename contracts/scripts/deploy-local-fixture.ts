import { ethers } from "hardhat";

const DAY = 24 * 60 * 60;

async function main() {
  const [deployer, beneficiary] = await ethers.getSigners();
  const fee = ethers.parseEther("0.01");
  const maxFee = ethers.parseEther("0.05");

  const Token = await ethers.getContractFactory("TestToken");
  const token = await Token.deploy();
  await token.waitForDeployment();

  const Locker = await ethers.getContractFactory("GenesisLocker");
  const locker = await Locker.deploy(fee, maxFee, deployer.address, deployer.address, beneficiary.address, 2_000, 2_000);
  await locker.waitForDeployment();

  const lockerAddress = await locker.getAddress();
  const tokenAddress = await token.getAddress();
  await token.approve(lockerAddress, ethers.parseEther("100"));

  const latest = await ethers.provider.getBlock("latest");
  const unlockTime = Number(latest?.timestamp || Math.floor(Date.now() / 1000)) + 8 * DAY;
  const tx = await locker.createCliffLock(
    tokenAddress,
    beneficiary.address,
    ethers.parseEther("10"),
    unlockTime,
    false,
    "local-fixture",
    { value: fee }
  );
  await tx.wait();

  console.log(JSON.stringify({
    chainId: 31337,
    lockerAddress,
    tokenAddress,
    lockId: "1",
    deployer: deployer.address,
    beneficiary: beneficiary.address
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
