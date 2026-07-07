import { expect } from "chai";
import { ethers } from "hardhat";
import { time, setBalance } from "@nomicfoundation/hardhat-network-helpers";

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
    // The beneficiary is the lock owner in this model, so it needs its own
    // balance + approval to top up locks it owns.
    await token.transfer(beneficiary.address, ethers.parseEther("1000"));

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
    await token.connect(beneficiary).approve(await locker.getAddress(), ethers.MaxUint256);
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

  it("makes the beneficiary the owner and denies the creator any control", async () => {
    const { user, beneficiary, token, locker } = await deployFixture();
    const unlockTime = (await time.latest()) + 8 * DAY;
    await locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: FEE });

    const lock = await locker.getLock(1);
    expect(lock.owner).to.equal(beneficiary.address);
    expect(lock.beneficiary).to.equal(beneficiary.address);

    // The creator (funder) retains no owner powers and cannot withdraw.
    await expect(locker.connect(user).extendLock(1, unlockTime + DAY)).to.be.revertedWith("Not lock owner");
    await expect(locker.connect(user).permanentLock(1)).to.be.revertedWith("Not lock owner");
    await time.increaseTo(unlockTime + 1);
    await expect(locker.connect(user).withdraw(1)).to.be.revertedWith("Not beneficiary");
  });

  it("only allows extending lock duration", async () => {
    const { user, beneficiary, token, locker } = await deployFixture();
    const unlockTime = (await time.latest()) + 8 * DAY;
    await locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: FEE });

    await expect(locker.connect(beneficiary).extendLock(1, unlockTime - DAY)).to.be.revertedWith("Can only extend");
    await expect(locker.connect(beneficiary).extendLock(1, unlockTime + DAY)).to.emit(locker, "LockExtended");

    const lock = await locker.getLock(1);
    expect(lock.endTime).to.equal(unlockTime + DAY);
    expect(lock.token).to.equal(await token.getAddress());
  });

  it("lets owners add more tokens without changing the asset", async () => {
    const { user, beneficiary, token, locker } = await deployFixture();
    const unlockTime = (await time.latest()) + 8 * DAY;
    await locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: FEE });

    await expect(locker.connect(beneficiary).increaseLockAmount(1, ethers.parseEther("5"))).to.emit(locker, "LockAmountIncreased");
    const lock = await locker.getLock(1);
    expect(lock.amount).to.equal(ethers.parseEther("15"));
  });

  it("allows withdrawals after unlock", async () => {
    const { user, beneficiary, token, locker } = await deployFixture();
    const unlockTime = (await time.latest()) + 8 * DAY;
    await locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: FEE });

    await time.increaseTo(unlockTime + 1);

    const balanceBefore = await token.balanceOf(beneficiary.address);
    await expect(locker.connect(beneficiary).withdraw(1)).to.emit(locker, "Withdrawn");
    expect(await token.balanceOf(beneficiary.address)).to.equal(balanceBefore + ethers.parseEther("10"));
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

    // The beneficiary owns the lock; transfer moves both owner and beneficiary
    // to nextOwner so they stay unified.
    await expect(locker.connect(beneficiary).transferLockOwnership(1, nextOwner.address)).to.emit(locker, "LockOwnershipTransferred");
    const moved = await locker.getLock(1);
    expect(moved.owner).to.equal(nextOwner.address);
    expect(moved.beneficiary).to.equal(nextOwner.address);

    await expect(locker.connect(nextOwner).permanentLock(1)).to.emit(locker, "LockPermanentlyLocked");

    await time.increaseTo(unlockTime + 1);
    // The previous beneficiary no longer has any rights, and the new owner is
    // blocked by the permanent lock.
    await expect(locker.connect(beneficiary).withdraw(1)).to.be.revertedWith("Not beneficiary");
    await expect(locker.connect(nextOwner).withdraw(1)).to.be.revertedWith("Permanently locked");
    expect(await locker.totalPermanentLocks()).to.equal(1);
  });

  it("recovers only surplus tokens (never locked funds) and stuck ETH, always to the owner", async () => {
    const { owner, user, beneficiary, nextOwner, token, locker } = await deployFixture();
    const lockerAddr = await locker.getAddress();
    const tokenAddr = await token.getAddress();
    const unlockTime = (await time.latest()) + 8 * DAY;
    await locker.connect(user).createCliffLock(tokenAddr, beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: FEE });

    // Someone accidentally transfers extra tokens straight to the contract.
    await token.connect(user).transfer(lockerAddr, ethers.parseEther("3"));

    // A non-owner can trigger recovery, but the surplus goes to the owner and the
    // locked 10 tokens are never touched.
    const ownerTokenBefore = await token.balanceOf(owner.address);
    await expect(locker.connect(nextOwner).withdrawStuckToken(tokenAddr))
      .to.emit(locker, "StuckTokenRecovered").withArgs(tokenAddr, owner.address, ethers.parseEther("3"));
    expect(await token.balanceOf(owner.address)).to.equal(ownerTokenBefore + ethers.parseEther("3"));
    expect(await token.balanceOf(lockerAddr)).to.equal(ethers.parseEther("10"));
    expect(await locker.totalLockedByToken(tokenAddr)).to.equal(ethers.parseEther("10"));

    // With no surplus left, recovery reverts — locked funds cannot be drained.
    await expect(locker.connect(nextOwner).withdrawStuckToken(tokenAddr)).to.be.revertedWith("No stuck tokens");

    // The beneficiary can still withdraw the full locked amount afterwards.
    await time.increaseTo(unlockTime + 1);
    const benBefore = await token.balanceOf(beneficiary.address);
    await locker.connect(beneficiary).withdraw(1);
    expect(await token.balanceOf(beneficiary.address)).to.equal(benBefore + ethers.parseEther("10"));

    // Stuck ETH (force-sent) is recoverable to the owner by anyone.
    await setBalance(lockerAddr, ethers.parseEther("1"));
    const ownerEthBefore = await ethers.provider.getBalance(owner.address);
    await expect(locker.connect(nextOwner).withdrawStuckETH())
      .to.emit(locker, "StuckETHRecovered").withArgs(owner.address, ethers.parseEther("1"));
    expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerEthBefore + ethers.parseEther("1"));
    expect(await ethers.provider.getBalance(lockerAddr)).to.equal(0);
  });

  it("blocks stuck-fund recovery once ownership is renounced (never burns to the zero address)", async () => {
    const { owner, user, token, locker } = await deployFixture();
    const lockerAddr = await locker.getAddress();
    const tokenAddr = await token.getAddress();

    await token.connect(user).transfer(lockerAddr, ethers.parseEther("3"));
    await setBalance(lockerAddr, ethers.parseEther("1"));

    await locker.connect(owner).renounceOwnership();
    expect(await locker.owner()).to.equal(ethers.ZeroAddress);

    // Recovery must revert rather than send funds to the dead address.
    await expect(locker.connect(user).withdrawStuckToken(tokenAddr)).to.be.revertedWith("Ownership renounced");
    await expect(locker.connect(user).withdrawStuckETH()).to.be.revertedWith("Ownership renounced");
  });
});
