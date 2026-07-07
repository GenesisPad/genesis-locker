import { ethers, network } from "hardhat";

const FEES: Record<string, bigint> = {
  robinhood: ethers.parseEther("0.01"),
  ethereum: ethers.parseEther("0.01"),
  base: ethers.parseEther("0.01"),
  bsc: ethers.parseEther("0.03")
};

const MAX_FEES: Record<string, bigint> = {
  robinhood: ethers.parseEther("0.1"),
  ethereum: ethers.parseEther("0.1"),
  base: ethers.parseEther("0.1"),
  bsc: ethers.parseEther("0.3")
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const fee = FEES[network.name] ?? ethers.parseEther(process.env.LOCK_CREATION_FEE || "0.01");
  const maxFee = MAX_FEES[network.name] ?? ethers.parseEther(process.env.MAX_LOCK_CREATION_FEE || "0.05");
  const founderFeeRecipient = process.env.FOUNDER_FEE_RECIPIENT || deployer.address;
  const communityFeeRecipient = process.env.COMMUNITY_FEE_RECIPIENT || deployer.address;
  const founderFeeShareBps = Number(process.env.FOUNDER_FEE_SHARE_BPS || 2_000);
  const maxFounderFeeShareBps = Number(process.env.MAX_FOUNDER_FEE_SHARE_BPS || 2_000);

  const Locker = await ethers.getContractFactory("GenesisLocker");
  const locker = await Locker.deploy(
    fee,
    maxFee,
    deployer.address,
    founderFeeRecipient,
    communityFeeRecipient,
    founderFeeShareBps,
    maxFounderFeeShareBps
  );
  await locker.waitForDeployment();

  console.log(JSON.stringify({
    network: network.name,
    chainId: network.config.chainId,
    locker: await locker.getAddress(),
    fee: fee.toString(),
    maxFee: maxFee.toString(),
    founderFeeRecipient,
    communityFeeRecipient,
    founderFeeShareBps,
    maxFounderFeeShareBps,
    deployer: deployer.address
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
