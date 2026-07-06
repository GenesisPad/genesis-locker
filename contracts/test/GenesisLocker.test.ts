import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const FEE = ethers.parseEther("0.01");
const MAX_FEE = ethers.parseEther("0.05");
const FOUNDER_SHARE_BPS = 2_000;
const MAX_FOUNDER_SHARE_BPS = 2_000;
const DAY = 24 * 60 * 60;

describe("GenesisLocker", () => {
  async function deployFixture() {
    const [owner, user, beneficiary, nextOwner, founder, community] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("TestToken");
    const token = await Token.deploy();
    await token.transfer(user.address, ethers.parseEther("1000"));

    const Locker = await ethers.getContractFactory("GenesisLocker");
    const locker = await Locker.deploy(
      FEE,
      MAX_FEE,
      owner.address,
      founder.address,
      community.address,
      FOUNDER_SHARE_BPS,
      MAX_FOUNDER_SHARE_BPS
    );

    await token.connect(user).approve(await locker.getAddress(), ethers.MaxUint256);
    return { owner, user, beneficiary, nextOwner, founder, community, token, locker };
  }

  it("creates cliff locks and distributes the configured fee", async () => {
    const { user, beneficiary, founder, community, token, locker } = await deployFixture();
    const unlockTime = (await time.latest()) + 8 * DAY;
    const founderBefore = await ethers.provider.getBalance(founder.address);
    const communityBefore = await ethers.provider.getBalance(community.address);
    const founderShare = (FEE * BigInt(FOUNDER_SHARE_BPS)) / 10_000n;
    const communityShare = FEE - founderShare;

    await expect(
      locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, true, "ipfs://lock", { value: FEE })
    ).to.emit(locker, "LockCreated")
      .and.to.emit(locker, "FeeDistributed").withArgs(1, founder.address, community.address, founderShare, communityShare);

    expect(await locker.totalActiveLocks()).to.equal(1);
    expect(await locker.totalFeesCollected()).to.equal(FEE);
    expect(await locker.totalLockedByToken(await token.getAddress())).to.equal(ethers.parseEther("10"));
    expect(await ethers.provider.getBalance(founder.address)).to.equal(founderBefore + founderShare);
    expect(await ethers.provider.getBalance(community.address)).to.equal(communityBefore + communityShare);
    expect(await ethers.provider.getBalance(await locker.getAddress())).to.equal(0);
  });

  it("lets the owner update fee settings within public caps", async () => {
    const { owner, user, beneficiary, nextOwner, community, token, locker } = await deployFixture();
    const newFee = ethers.parseEther("0.02");
    const founderShareBps = 1_000;
    const unlockTime = (await time.latest()) + 8 * DAY;

    await expect(locker.connect(user).setCreationFee(newFee)).to.be.revertedWithCustomError(locker, "OwnableUnauthorizedAccount");
    await expect(locker.connect(owner).setCreationFee(MAX_FEE + 1n)).to.be.revertedWith("Fee above max");
    await expect(locker.connect(owner).setCreationFee(newFee)).to.emit(locker, "CreationFeeUpdated").withArgs(FEE, newFee);

    await expect(locker.connect(owner).setFeeRecipients(ethers.ZeroAddress, community.address)).to.be.revertedWith("Zero founder recipient");
    await expect(locker.connect(owner).setFeeRecipients(nextOwner.address, community.address)).to.emit(locker, "FeeRecipientsUpdated").withArgs(nextOwner.address, community.address);

    await expect(locker.connect(owner).setFounderFeeShareBps(MAX_FOUNDER_SHARE_BPS + 1)).to.be.revertedWith("Split above max");
    await expect(locker.connect(owner).setFounderFeeShareBps(founderShareBps)).to.emit(locker, "FeeSplitUpdated").withArgs(FOUNDER_SHARE_BPS, founderShareBps);

    const founderBefore = await ethers.provider.getBalance(nextOwner.address);
    const communityBefore = await ethers.provider.getBalance(community.address);
    const founderShare = (newFee * BigInt(founderShareBps)) / 10_000n;
    const communityShare = newFee - founderShare;

    await locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: newFee });

    expect(await ethers.provider.getBalance(nextOwner.address)).to.equal(founderBefore + founderShare);
    expect(await ethers.provider.getBalance(community.address)).to.equal(communityBefore + communityShare);
  });

  it("rejects invalid lock creation", async () => {
    const { user, beneficiary, token, locker } = await deployFixture();
    const tooSoon = (await time.latest()) + 6 * DAY;
    const valid = (await time.latest()) + 8 * DAY;

    await expect(
      locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), tooSoon, false, "", { value: FEE })
    ).to.be.revertedWith("Duration below minimum");

    await expect(
      locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, 0, valid, false, "", { value: FEE })
    ).to.be.revertedWith("Zero amount");

    await expect(
      locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), valid, false, "", { value: 0 })
    ).to.be.revertedWith("Invalid fee");
  });

  it("only allows extending lock duration", async () => {
    const { user, beneficiary, token, locker } = await deployFixture();
    const unlockTime = (await time.latest()) + 8 * DAY;
    await locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: FEE });

    await expect(locker.connect(user).extendLock(1, unlockTime - DAY)).to.be.revertedWith("Can only extend");
    await expect(locker.connect(user).extendLock(1, unlockTime + DAY)).to.emit(locker, "LockExtended");

    const lock = await locker.getLock(1);
    expect(lock.endTime).to.equal(unlockTime + DAY);
    expect(lock.token).to.equal(await token.getAddress());
  });

  it("lets owners add more tokens without changing the asset", async () => {
    const { user, beneficiary, token, locker } = await deployFixture();
    const unlockTime = (await time.latest()) + 8 * DAY;
    await locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: FEE });

    await expect(locker.connect(user).increaseLockAmount(1, ethers.parseEther("5"))).to.emit(locker, "LockAmountIncreased");
    const lock = await locker.getLock(1);
    expect(lock.amount).to.equal(ethers.parseEther("15"));
  });

  it("allows withdrawals after unlock", async () => {
    const { user, beneficiary, token, locker } = await deployFixture();
    const unlockTime = (await time.latest()) + 8 * DAY;
    await locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: FEE });

    await time.increaseTo(unlockTime + 1);

    await expect(locker.connect(beneficiary).withdraw(1)).to.emit(locker, "Withdrawn");
    expect(await token.balanceOf(beneficiary.address)).to.equal(ethers.parseEther("10"));
  });

  it("supports vesting claim calculations", async () => {
    const { user, beneficiary, token, locker } = await deployFixture();
    const start = await time.latest();
    const cliff = start + 8 * DAY;
    const end = start + 40 * DAY;

    await locker.connect(user).createVestingLock(await token.getAddress(), beneficiary.address, ethers.parseEther("40"), cliff, end, DAY, false, "", { value: FEE });
    const lock = await locker.getLock(1);
    await time.increaseTo(Number(lock.startTime) + 20 * DAY);
    const expected = (lock.amount * BigInt(20 * DAY)) / (lock.endTime - lock.startTime);

    expect(await locker.getClaimableAmount(1)).to.equal(expected);
  });

  it("transfers lock ownership and permanently locks withdrawal rights", async () => {
    const { user, beneficiary, nextOwner, token, locker } = await deployFixture();
    const unlockTime = (await time.latest()) + 8 * DAY;
    await locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, true, "", { value: FEE });

    await expect(locker.connect(user).transferLockOwnership(1, nextOwner.address)).to.emit(locker, "LockOwnershipTransferred");
    await expect(locker.connect(nextOwner).permanentLock(1)).to.emit(locker, "LockPermanentlyLocked");

    await time.increaseTo(unlockTime + 1);
    await expect(locker.connect(beneficiary).withdraw(1)).to.be.revertedWith("Permanently locked");
    expect(await locker.totalPermanentLocks()).to.equal(1);
  });
});
