import { expect } from "chai";
import { ethers } from "hardhat";

describe("GenesisLockerRegistry", function () {
  async function deployFixture() {
    const [owner, authorizedLocker, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("GenesisLockerRegistry");
    const registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();
    await (await registry.setAuthorizedLocker(authorizedLocker.address, true)).wait();
    return { owner, authorizedLocker, other, registry };
  }

  it("only an authorized locker may register a lock", async function () {
    const fx = await deployFixture();
    await expect(
      fx.registry.connect(fx.other).registerLock(2, fx.other.address, 1, fx.other.address, fx.other.address, true, 0),
    ).to.be.revertedWithCustomError(fx.registry, "NotAuthorizedLocker");

    await expect(
      fx.registry
        .connect(fx.authorizedLocker)
        .registerLock(2, fx.authorizedLocker.address, 1, fx.other.address, fx.other.address, true, 0),
    ).to.not.be.reverted;
  });

  it("assigns sequential lock IDs starting at 1", async function () {
    const fx = await deployFixture();
    const tx1 = await fx.registry
      .connect(fx.authorizedLocker)
      .registerLock(2, fx.authorizedLocker.address, 1, fx.other.address, fx.other.address, true, 0);
    const r1 = await tx1.wait();
    const log1 = r1!.logs
      .map((l: any) => {
        try {
          return fx.registry.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((p: any) => p && p.name === "LockRegistered")!;
    expect(log1.args.lockId).to.equal(1n);

    const tx2 = await fx.registry
      .connect(fx.authorizedLocker)
      .registerLock(2, fx.authorizedLocker.address, 2, fx.other.address, fx.other.address, true, 0);
    const r2 = await tx2.wait();
    const log2 = r2!.logs
      .map((l: any) => {
        try {
          return fx.registry.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((p: any) => p && p.name === "LockRegistered")!;
    expect(log2.args.lockId).to.equal(2n);
  });

  it("only the locker that registered a lock may deactivate it", async function () {
    const fx = await deployFixture();
    await (
      await fx.registry
        .connect(fx.authorizedLocker)
        .registerLock(2, fx.authorizedLocker.address, 1, fx.other.address, fx.other.address, true, 0)
    ).wait();

    await expect(fx.registry.connect(fx.other).deactivateLock(1)).to.be.revertedWithCustomError(fx.registry, "NotRegisteredBy");
    await expect(fx.registry.connect(fx.authorizedLocker).deactivateLock(1)).to.not.be.reverted;
    expect((await fx.registry.getLock(1)).active).to.equal(false);
  });

  it("only the owner can authorize/deauthorize a locker", async function () {
    const fx = await deployFixture();
    await expect(fx.registry.connect(fx.other).setAuthorizedLocker(fx.other.address, true)).to.be.reverted;
  });
});
