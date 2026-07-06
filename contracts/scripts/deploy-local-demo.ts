import { ethers } from "hardhat";

const DAY = 24 * 60 * 60;
const fee = ethers.parseEther("0.01");
const maxFee = ethers.parseEther("0.05");

const demoAssets = [
  { tokenName: "Open Alpha", tokenSymbol: "OALP", dex: "Uniswap V2", lpName: "Uniswap V2 OALP/WETH LP", lpSymbol: "UNI-OALP-WETH" },
  { tokenName: "Locker Base", tokenSymbol: "LBSE", dex: "SushiSwap", lpName: "SushiSwap LBSE/USDC LP", lpSymbol: "SUSHI-LBSE-USDC" },
  { tokenName: "Vault BNB", tokenSymbol: "VBNB", dex: "PancakeSwap", lpName: "PancakeSwap VBNB/BNB LP", lpSymbol: "CAKE-VBNB-BNB" },
  { tokenName: "Cliff Coin", tokenSymbol: "CLIF", dex: "Aerodrome", lpName: "Aerodrome CLIF/ETH LP", lpSymbol: "AERO-CLIF-ETH" },
  { tokenName: "Vesting DAO", tokenSymbol: "VDAO", dex: "Balancer", lpName: "Balancer VDAO/USDT LP", lpSymbol: "BAL-VDAO-USDT" },
  { tokenName: "Permanent Proof", tokenSymbol: "PPROOF", dex: "Curve", lpName: "Curve PPROOF/crvUSD LP", lpSymbol: "CRV-PPROOF-CRVUSD" },
  { tokenName: "Dex Signal", tokenSymbol: "DSIG", dex: "Trader Joe", lpName: "Trader Joe DSIG/AVAX LP", lpSymbol: "JOE-DSIG-AVAX" }
];

function future(base: number, days: number) {
  return base + days * DAY;
}

async function main() {
  const [deployer, beneficiary, secondBeneficiary] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("MockERC20");
  const DexFactory = await ethers.getContractFactory("MockDexFactory");
  const Locker = await ethers.getContractFactory("GenesisLocker");
  const locker = await Locker.deploy(fee, maxFee, deployer.address, deployer.address, beneficiary.address, 2_000, 2_000);
  await locker.waitForDeployment();

  const lockerAddress = await locker.getAddress();
  const latest = await ethers.provider.getBlock("latest");
  const baseTime = Number(latest?.timestamp || Math.floor(Date.now() / 1000));
  const locks: Array<Record<string, string | number | boolean>> = [];

  for (let i = 0; i < demoAssets.length; i += 1) {
    const asset = demoAssets[i];
    const token = await Token.deploy(asset.tokenName, asset.tokenSymbol, ethers.parseEther("1000000"));
    await token.waitForDeployment();
    const quote = await Token.deploy(`${asset.dex} Quote`, `${asset.dex.slice(0, 4).toUpperCase()}Q`, ethers.parseEther("1000000"));
    await quote.waitForDeployment();
    const dexFactory = await DexFactory.deploy(asset.dex);
    await dexFactory.waitForDeployment();

    const tokenAddress = await token.getAddress();
    const quoteAddress = await quote.getAddress();
    const pairTx = await dexFactory.createPair(tokenAddress, quoteAddress, asset.lpName, asset.lpSymbol, ethers.parseEther("50000"));
    const pairReceipt = await pairTx.wait();
    const pairEvent = pairReceipt?.logs
      .map((log) => {
        try { return dexFactory.interface.parseLog(log); } catch { return null; }
      })
      .find((log) => log?.name === "PairCreated");
    const lpAddress = String(pairEvent?.args.pair);
    await token.approve(lockerAddress, ethers.parseEther("1000000"));
    const lp = await ethers.getContractAt("MockERC20", lpAddress);
    await lp.approve(lockerAddress, ethers.parseEther("50000"));

    const lpAmount = ethers.parseEther(String(100 + i * 25));
    const tokenAmount = ethers.parseEther(String(10000 + i * 2500));
    const lpUnlock = future(baseTime, 45 + i * 30);
    const tokenUnlock = future(baseTime, 90 + i * 45);

    let tx;
    if (i % 2 === 0) {
      tx = await locker.createCliffLock(
        lpAddress,
        beneficiary.address,
        lpAmount,
        lpUnlock,
        true,
        `demo://${asset.dex}/lp/${asset.lpSymbol}`,
        { value: fee }
      );
    } else {
      tx = await locker.createVestingLock(
        lpAddress,
        beneficiary.address,
        lpAmount,
        future(baseTime, 14),
        lpUnlock,
        7 * DAY,
        true,
        `demo://${asset.dex}/lp/${asset.lpSymbol}`,
        { value: fee }
      );
    }
    await tx.wait();
    const lpLockId = await locker.totalLocks();

    if (i === 2 || i === 5) {
      await (await locker.permanentLock(lpLockId)).wait();
    }

    tx = await locker.createVestingLock(
      tokenAddress,
      i % 2 === 0 ? beneficiary.address : secondBeneficiary.address,
      tokenAmount,
      future(baseTime, 14 + i),
      tokenUnlock,
      i % 3 === 0 ? DAY : 30 * DAY,
      false,
      `demo://token/${asset.tokenSymbol}`,
      { value: fee }
    );
    await tx.wait();
    const tokenLockId = await locker.totalLocks();

    if (i === 6) {
      await (await locker.permanentLock(tokenLockId)).wait();
    }

    locks.push({
      dex: asset.dex,
      tokenName: asset.tokenName,
      tokenSymbol: asset.tokenSymbol,
      tokenAddress,
      lpAddress,
      quoteAddress,
      dexFactoryAddress: await dexFactory.getAddress(),
      lpSymbol: asset.lpSymbol,
      lpLockId: lpLockId.toString(),
      tokenLockId: tokenLockId.toString(),
      lpPermanent: i === 2 || i === 5,
      tokenPermanent: i === 6
    });
  }

  console.log(JSON.stringify({
    chainId: 31337,
    lockerAddress,
    deployer: deployer.address,
    beneficiary: beneficiary.address,
    assets: locks
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
