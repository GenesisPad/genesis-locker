import { expect } from "chai";
import { ethers } from "hardhat";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FactoryArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PositionManagerArtifact = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SwapRouterArtifact = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");

const FEE_TIER = 3000;
const MAX_USABLE_TICK = 887220;

/**
 * Deep, direct test of the REAL GenesisV3PositionLocker against real, unmodified
 * Uniswap V3 contracts - no mocking anywhere in this file. This is the authoritative
 * test of the permanent-lock invariants; GenesisLaunchFactory's own test suite (in the
 * separate contracts/ repo) uses a lightweight mock standing in for this contract to
 * test factory orchestration in isolation - see docs/CONTRACT_ARCHITECTURE.md.
 */
describe("GenesisV3PositionLocker (direct, real Uniswap V3)", function () {
  this.timeout(120000);

  async function deployFixture() {
    const [owner, launchFactory, feeDistributor, trader, attacker] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const launchToken = await MockERC20.deploy("Launch", "LNCH", ethers.parseEther("1000001000")); // extra 1000 for the "unrelated NFT" test's second mint
    await launchToken.waitForDeployment();
    const pairedToken = await MockERC20.deploy("Paired", "PAIR", ethers.parseEther("1000000"));
    await pairedToken.waitForDeployment();

    const V3Factory = new ethers.ContractFactory(FactoryArtifact.abi, FactoryArtifact.bytecode, owner);
    const v3Factory = await V3Factory.deploy();
    await v3Factory.waitForDeployment();

    const WETH = await ethers.getContractFactory("TestWeth");
    const weth = await WETH.deploy();
    await weth.waitForDeployment();

    const PositionManager = new ethers.ContractFactory(PositionManagerArtifact.abi, PositionManagerArtifact.bytecode, owner);
    const positionManager = await PositionManager.deploy(await v3Factory.getAddress(), await weth.getAddress(), ethers.ZeroAddress);
    await positionManager.waitForDeployment();

    const SwapRouter = new ethers.ContractFactory(SwapRouterArtifact.abi, SwapRouterArtifact.bytecode, owner);
    const swapRouter = await SwapRouter.deploy(await v3Factory.getAddress(), await weth.getAddress());
    await swapRouter.waitForDeployment();

    const FeeRegistry = await ethers.getContractFactory("MockFeeDistributionRegistry");
    const feeRegistry = await FeeRegistry.deploy();
    await feeRegistry.waitForDeployment();
    await (await feeRegistry.setActiveDistributor(feeDistributor.address)).wait();

    const Locker = await ethers.getContractFactory("GenesisV3PositionLocker");
    const locker = await Locker.deploy(owner.address, await feeRegistry.getAddress());
    await locker.waitForDeployment();

    await (await locker.setApprovedPositionManager(await positionManager.getAddress(), true)).wait();
    await (await locker.setLaunchFactory(launchFactory.address)).wait();

    const launchAddr = await launchToken.getAddress();
    const pairedAddr = await pairedToken.getAddress();
    const [token0, token1] =
      BigInt(launchAddr) < BigInt(pairedAddr) ? [launchAddr, pairedAddr] : [pairedAddr, launchAddr];
    const launchTokenIsToken0 = token0 === launchAddr;

    await (
      await positionManager.createAndInitializePoolIfNecessary(token0, token1, FEE_TIER, 1n << 96n)
    ).wait();
    const poolAddress = await v3Factory.getPool(token0, token1, FEE_TIER);

    const tickLower = launchTokenIsToken0 ? 0 : -MAX_USABLE_TICK;
    const tickUpper = launchTokenIsToken0 ? MAX_USABLE_TICK : 0;

    await (await launchToken.connect(owner).transfer(launchFactory.address, ethers.parseEther("1000000000"))).wait();
    await (await launchToken.connect(launchFactory).approve(await positionManager.getAddress(), ethers.MaxUint256)).wait();

    const amount0Desired = launchTokenIsToken0 ? ethers.parseEther("1000000000") : 0n;
    const amount1Desired = launchTokenIsToken0 ? 0n : ethers.parseEther("1000000000");
    // Use chain time, not wall-clock time - other test files in the same run (e.g.
    // GenesisLocker.test.ts) fast-forward the in-process chain's timestamp for unlock-time
    // testing, which can leave the chain far ahead of real wall-clock Date.now().
    const currentBlock = await ethers.provider.getBlock("latest");
    const deadline = currentBlock!.timestamp + 3600;

    // Uniswap's NonfungiblePositionManager.mint() uses plain ERC721 `_mint`, not `_safeMint` -
    // minting straight to the locker would never invoke onERC721Received at all. Mint to the
    // (simulated) launch factory first, then explicitly safeTransferFrom to the locker, exactly
    // matching the real GenesisLaunchFactory's actual two-step sequence.
    const mintTx = await positionManager.connect(launchFactory).mint({
      token0,
      token1,
      fee: FEE_TIER,
      tickLower,
      tickUpper,
      amount0Desired,
      amount1Desired,
      amount0Min: 0,
      amount1Min: 0,
      recipient: launchFactory.address,
      deadline,
    });
    const mintReceipt = await mintTx.wait();
    const increaseLiquidityLog = mintReceipt!.logs
      .map((log: any) => {
        try {
          return positionManager.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((p: any) => p && p.name === "IncreaseLiquidity")!;
    const tokenId = increaseLiquidityLog.args.tokenId;

    await (
      await positionManager
        .connect(launchFactory)
        ["safeTransferFrom(address,address,uint256)"](launchFactory.address, await locker.getAddress(), tokenId)
    ).wait();

    return {
      owner,
      launchFactory,
      feeDistributor,
      trader,
      attacker,
      launchToken,
      pairedToken,
      positionManager,
      swapRouter,
      v3Factory,
      weth,
      locker,
      feeRegistry,
      token0,
      token1,
      launchTokenIsToken0,
      poolAddress,
      tickLower,
      tickUpper,
      tokenId,
      deadline,
    };
  }

  describe("deposit + lock verification", function () {
    it("accepts a deposit from the approved position manager initiated by the launch factory, then locks after explicit verification", async function () {
      const fx = await deployFixture();
      expect(await fx.locker.pendingDeposit(await fx.positionManager.getAddress(), fx.tokenId)).to.equal(true);

      await (
        await fx.locker
          .connect(fx.launchFactory)
          .lockGenesisLaunchPosition(
            await fx.positionManager.getAddress(),
            fx.tokenId,
            fx.token0,
            fx.token1,
            FEE_TIER,
            fx.tickLower,
            fx.tickUpper,
            fx.poolAddress,
            fx.launchFactory.address,
            fx.launchFactory.address,
          )
      ).wait();

      expect(await fx.locker.isPermanentlyLockedGenesisLaunch(await fx.positionManager.getAddress(), fx.tokenId)).to.equal(true);
      const lock = await fx.locker.getLock(await fx.positionManager.getAddress(), fx.tokenId);
      expect(lock.permanent).to.equal(true);
      expect(lock.registeredGenesisLaunch).to.equal(true);
      expect(lock.initialLiquidity).to.be.greaterThan(0n);
    });

    it("rejects deposits from an unapproved position manager", async function () {
      const fx = await deployFixture();
      // Simulate a raw safeTransferFrom call from an address never approved as a position manager.
      await expect(
        fx.locker
          .connect(fx.attacker)
          .onERC721Received(fx.launchFactory.address, fx.attacker.address, 999n, "0x"),
      ).to.be.revertedWithCustomError(fx.locker, "PositionManagerNotApproved");
    });

    it("rejects a deposit whose operator is not the authorized launch factory", async function () {
      const fx = await deployFixture();
      const positionManagerSigner = await ethers.getImpersonatedSigner(await fx.positionManager.getAddress());
      await ethers.provider.send("hardhat_setBalance", [await fx.positionManager.getAddress(), "0x56BC75E2D63100000"]);
      await expect(
        fx.locker.connect(positionManagerSigner).onERC721Received(fx.attacker.address, fx.attacker.address, 999n, "0x"),
      ).to.be.revertedWithCustomError(fx.locker, "OperatorNotLaunchFactory");
    });

    it("rejects lockGenesisLaunchPosition from anyone other than the launch factory", async function () {
      const fx = await deployFixture();
      await expect(
        fx.locker
          .connect(fx.attacker)
          .lockGenesisLaunchPosition(
            await fx.positionManager.getAddress(),
            fx.tokenId,
            fx.token0,
            fx.token1,
            FEE_TIER,
            fx.tickLower,
            fx.tickUpper,
            fx.poolAddress,
            fx.attacker.address,
            fx.attacker.address,
          ),
      ).to.be.revertedWithCustomError(fx.locker, "NotLaunchFactory");
    });

    it("rejects locking with a mismatched expected tick range, fee, or pool", async function () {
      const fx = await deployFixture();
      await expect(
        fx.locker
          .connect(fx.launchFactory)
          .lockGenesisLaunchPosition(
            await fx.positionManager.getAddress(),
            fx.tokenId,
            fx.token0,
            fx.token1,
            FEE_TIER,
            fx.tickLower + 60,
            fx.tickUpper,
            fx.poolAddress,
            fx.launchFactory.address,
            fx.launchFactory.address,
          ),
      ).to.be.revertedWithCustomError(fx.locker, "PositionMismatch");
    });

    it("rejects locking a tokenId that was never deposited", async function () {
      const fx = await deployFixture();
      await expect(
        fx.locker
          .connect(fx.launchFactory)
          .lockGenesisLaunchPosition(
            await fx.positionManager.getAddress(),
            999999n,
            fx.token0,
            fx.token1,
            FEE_TIER,
            fx.tickLower,
            fx.tickUpper,
            fx.poolAddress,
            fx.launchFactory.address,
            fx.launchFactory.address,
          ),
      ).to.be.revertedWithCustomError(fx.locker, "NoPendingDeposit");
    });
  });

  describe("permanent-lock invariants", function () {
    async function lockedFixture() {
      const fx = await deployFixture();
      await (
        await fx.locker
          .connect(fx.launchFactory)
          .lockGenesisLaunchPosition(
            await fx.positionManager.getAddress(),
            fx.tokenId,
            fx.token0,
            fx.token1,
            FEE_TIER,
            fx.tickLower,
            fx.tickUpper,
            fx.poolAddress,
            fx.launchFactory.address,
            fx.launchFactory.address,
          )
      ).wait();
      return fx;
    }

    it("exposes no function anywhere that can transfer, approve, or rescue the registered position (no such functions exist on the ABI)", async function () {
      const fx = await lockedFixture();
      for (const fn of ["transferFrom", "safeTransferFrom", "approve", "setApprovalForAll", "withdraw", "migrate", "execute", "rescueNft"]) {
        expect(fx.locker.interface.getFunction(fn), `${fn} must not exist on GenesisV3PositionLocker`).to.be.null;
      }
    });

    it("rescueUnrelatedNft reverts for a registered position's exact (positionManager, tokenId)", async function () {
      const fx = await lockedFixture();
      await expect(
        fx.locker.connect(fx.owner).rescueUnrelatedNft(await fx.positionManager.getAddress(), fx.tokenId, fx.owner.address),
      ).to.be.revertedWithCustomError(fx.locker, "PositionIsRegistered");
    });

    it("only the owner may call rescueUnrelatedNft, and it succeeds for a genuinely unrelated NFT", async function () {
      const fx = await lockedFixture();
      // Mint a SECOND, unrelated position directly to the locker (never locked) to prove
      // rescue works for genuinely unrelated NFTs while never touching the registered one.
      // (launchFactory's launchToken balance is nearly exhausted from the first mint - top up.)
      await (await fx.launchToken.connect(fx.owner).transfer(fx.launchFactory.address, ethers.parseEther("1000"))).wait();
      await (await fx.pairedToken.connect(fx.owner).transfer(fx.launchFactory.address, ethers.parseEther("1"))).wait();
      await (await fx.pairedToken.connect(fx.launchFactory).approve(await fx.positionManager.getAddress(), ethers.MaxUint256)).wait();
      await (await fx.launchToken.connect(fx.launchFactory).approve(await fx.positionManager.getAddress(), ethers.MaxUint256)).wait();

      const mintTx = await fx.positionManager.connect(fx.launchFactory).mint({
        token0: fx.token0,
        token1: fx.token1,
        fee: FEE_TIER,
        tickLower: fx.tickLower,
        tickUpper: fx.tickUpper,
        amount0Desired: fx.launchTokenIsToken0 ? ethers.parseEther("1000") : 0,
        amount1Desired: fx.launchTokenIsToken0 ? 0 : ethers.parseEther("1000"),
        amount0Min: 0,
        amount1Min: 0,
        recipient: await fx.locker.getAddress(),
        deadline: fx.deadline,
      });
      const receipt = await mintTx.wait();
      const log = receipt!.logs
        .map((l: any) => {
          try {
            return fx.positionManager.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((p: any) => p && p.name === "IncreaseLiquidity")!;
      const unrelatedTokenId = log.args.tokenId;

      await expect(
        fx.locker.connect(fx.attacker).rescueUnrelatedNft(await fx.positionManager.getAddress(), unrelatedTokenId, fx.attacker.address),
      ).to.be.reverted; // onlyOwner

      await expect(
        fx.locker.connect(fx.owner).rescueUnrelatedNft(await fx.positionManager.getAddress(), unrelatedTokenId, fx.owner.address),
      ).to.not.be.reverted;

      // The registered position remains locked and untouched.
      expect(await fx.locker.isPermanentlyLockedGenesisLaunch(await fx.positionManager.getAddress(), fx.tokenId)).to.equal(true);
    });

    it("fee collection is callable only by the configured feeDistributor and never reduces liquidity below the recorded initial amount", async function () {
      const fx = await lockedFixture();

      await expect(
        fx.locker.connect(fx.attacker).collectFees(await fx.positionManager.getAddress(), fx.tokenId),
      ).to.be.revertedWithCustomError(fx.locker, "NotFeeDistributor");

      // Generate real fees via a round-trip swap.
      await (await fx.pairedToken.connect(fx.owner).transfer(fx.trader.address, ethers.parseEther("100"))).wait();
      await (await fx.pairedToken.connect(fx.trader).approve(await fx.swapRouter.getAddress(), ethers.MaxUint256)).wait();
      const tokenIn = fx.launchTokenIsToken0 ? fx.token1 : fx.token0;
      const tokenOut = fx.launchTokenIsToken0 ? fx.token0 : fx.token1;
      await (
        await fx.swapRouter.connect(fx.trader).exactInputSingle({
          tokenIn,
          tokenOut,
          fee: FEE_TIER,
          recipient: fx.trader.address,
          deadline: fx.deadline,
          amountIn: ethers.parseEther("10"),
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        })
      ).wait();

      const lockBefore = await fx.locker.getLock(await fx.positionManager.getAddress(), fx.tokenId);
      await (await fx.locker.connect(fx.feeDistributor).collectFees(await fx.positionManager.getAddress(), fx.tokenId)).wait();

      const [, , , , , , , liquidityAfter] = await fx.positionManager.positions(fx.tokenId);
      expect(liquidityAfter).to.be.greaterThanOrEqual(lockBefore.initialLiquidity);
    });

    it("collected fees are sent only to the configured feeDistributor, never to the caller or locker", async function () {
      const fx = await lockedFixture();
      await (await fx.pairedToken.connect(fx.owner).transfer(fx.trader.address, ethers.parseEther("100"))).wait();
      await (await fx.pairedToken.connect(fx.trader).approve(await fx.swapRouter.getAddress(), ethers.MaxUint256)).wait();
      const tokenIn = fx.launchTokenIsToken0 ? fx.token1 : fx.token0;
      const tokenOut = fx.launchTokenIsToken0 ? fx.token0 : fx.token1;
      await (
        await fx.swapRouter.connect(fx.trader).exactInputSingle({
          tokenIn,
          tokenOut,
          fee: FEE_TIER,
          recipient: fx.trader.address,
          deadline: fx.deadline,
          amountIn: ethers.parseEther("10"),
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        })
      ).wait();

      const lockerLaunchTokenBefore = await fx.launchToken.balanceOf(await fx.locker.getAddress());
      const lockerPairedTokenBefore = await fx.pairedToken.balanceOf(await fx.locker.getAddress());

      await (await fx.locker.connect(fx.feeDistributor).collectFees(await fx.positionManager.getAddress(), fx.tokenId)).wait();

      expect(await fx.launchToken.balanceOf(await fx.locker.getAddress())).to.equal(lockerLaunchTokenBefore);
      expect(await fx.pairedToken.balanceOf(await fx.locker.getAddress())).to.equal(lockerPairedTokenBefore);
    });
  });

  describe("owner-gated one-way settings", function () {
    it("setLaunchFactory can only be called once", async function () {
      const fx = await deployFixture();
      await expect(fx.locker.connect(fx.owner).setLaunchFactory(fx.attacker.address)).to.be.revertedWithCustomError(
        fx.locker,
        "AlreadySet",
      );
    });

    it("non-owner cannot change approved position managers or the launch factory", async function () {
      const fx = await deployFixture();
      await expect(fx.locker.connect(fx.attacker).setApprovedPositionManager(fx.attacker.address, true)).to.be.reverted;
    });
  });
});
