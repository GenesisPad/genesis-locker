import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const FEE = ethers.parseEther("0.01");
const MAX_FEE = ethers.parseEther("0.05");
const FOUNDER_SHARE_BPS = 2_000;
const MAX_FOUNDER_SHARE_BPS = 2_000;
const DAY = 24 * 60 * 60;

describe("GenesisLockerV2", () => {
  async function deployFixture() {
    const [owner, user, beneficiary, founder, community] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("TestToken");
    const token = await Token.deploy();
    await token.transfer(user.address, ethers.parseEther("1000"));
    await token.transfer(beneficiary.address, ethers.parseEther("1000"));

    const Locker = await ethers.getContractFactory("GenesisLockerV2");
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
    return { owner, user, beneficiary, founder, community, token, locker };
  }

  it("behaves exactly like GenesisLocker for a non-exempt caller (regression: unchanged fee-required path)", async () => {
    const { user, beneficiary, token, locker } = await deployFixture();
    const unlockTime = (await time.latest()) + 8 * DAY;

    await expect(
      locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: FEE })
    ).to.emit(locker, "LockCreated");

    await expect(
      locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: 0 })
    ).to.be.revertedWith("Invalid fee");
  });

  describe("fee-exemption whitelist", () => {
    it("non-owner cannot exempt any address", async () => {
      const { user, locker } = await deployFixture();
      await expect(locker.connect(user).setFeeExempt(user.address, true)).to.be.revertedWithCustomError(
        locker,
        "OwnableUnauthorizedAccount"
      );
    });

    it("owner can exempt an address, and an exempt caller creates a lock while sending zero fee", async () => {
      const { owner, user, beneficiary, token, locker } = await deployFixture();
      const unlockTime = (await time.latest()) + 8 * DAY;

      await expect(locker.connect(owner).setFeeExempt(user.address, true))
        .to.emit(locker, "FeeExemptionSet")
        .withArgs(user.address, true);
      expect(await locker.feeExempt(user.address)).to.equal(true);

      await expect(
        locker
          .connect(user)
          .createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: 0 })
      ).to.emit(locker, "LockCreated");

      expect(await locker.totalLockedByToken(await token.getAddress())).to.equal(ethers.parseEther("10"));
    });

    it("an exempt address still reverts if it sends a nonzero value (fee must be exactly the required amount)", async () => {
      const { owner, user, beneficiary, token, locker } = await deployFixture();
      const unlockTime = (await time.latest()) + 8 * DAY;
      await locker.connect(owner).setFeeExempt(user.address, true);

      await expect(
        locker
          .connect(user)
          .createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: FEE })
      ).to.be.revertedWith("Invalid fee");
    });

    it("a non-exempt address is unaffected and must still pay the full creationFee", async () => {
      const { owner, user, beneficiary, token, locker } = await deployFixture();
      const unlockTime = (await time.latest()) + 8 * DAY;
      // Exempt a different, unrelated address - user's own requirement is untouched.
      await locker.connect(owner).setFeeExempt(beneficiary.address, true);

      await expect(
        locker
          .connect(user)
          .createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: 0 })
      ).to.be.revertedWith("Invalid fee");
    });

    it("exemption can be revoked, after which the address must pay the fee again", async () => {
      const { owner, user, beneficiary, token, locker } = await deployFixture();
      const unlockTime = (await time.latest()) + 8 * DAY;

      await locker.connect(owner).setFeeExempt(user.address, true);
      await expect(
        locker
          .connect(user)
          .createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: 0 })
      ).to.emit(locker, "LockCreated");

      await expect(locker.connect(owner).setFeeExempt(user.address, false))
        .to.emit(locker, "FeeExemptionSet")
        .withArgs(user.address, false);

      await expect(
        locker
          .connect(user)
          .createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), unlockTime, false, "", { value: 0 })
      ).to.be.revertedWith("Invalid fee");
    });

    it("rejects exempting the zero address", async () => {
      const { owner, locker } = await deployFixture();
      await expect(locker.connect(owner).setFeeExempt(ethers.ZeroAddress, true)).to.be.revertedWith("Zero account");
    });

    it("exemption does not bypass the minimum-duration or other unrelated validation", async () => {
      const { owner, user, beneficiary, token, locker } = await deployFixture();
      await locker.connect(owner).setFeeExempt(user.address, true);
      const tooSoon = (await time.latest()) + 6 * DAY;

      await expect(
        locker.connect(user).createCliffLock(await token.getAddress(), beneficiary.address, ethers.parseEther("10"), tooSoon, false, "", { value: 0 })
      ).to.be.revertedWith("Duration below minimum");
    });
  });
});
