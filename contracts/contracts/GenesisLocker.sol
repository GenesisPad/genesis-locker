// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract GenesisLocker is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MIN_LOCK_DURATION = 7 days;

    struct Lock {
        uint256 lockId;
        address token;
        address owner;
        address beneficiary;
        uint256 amount;
        uint256 withdrawnAmount;
        uint256 startTime;
        uint256 cliffTime;
        uint256 endTime;
        uint256 vestingInterval;
        bool isVesting;
        bool isLpToken;
        bool isPermanent;
        uint256 createdAt;
        string metadataURI;
    }

    uint16 public constant BPS_DENOMINATOR = 10_000;

    uint256 public creationFee;
    uint256 public immutable maxCreationFee;
    address payable public founderFeeRecipient;
    address payable public communityFeeRecipient;
    uint16 public founderFeeShareBps;
    uint16 public immutable maxFounderFeeShareBps;

    uint256 public nextLockId = 1;
    uint256 public activeLocks;
    uint256 public permanentLocks;
    uint256 public totalFeesCollected;

    mapping(uint256 => Lock) private locks;
    mapping(address => uint256[]) private userLocks;
    mapping(address => uint256[]) private tokenLocks;
    mapping(address => uint256) public totalLockedByToken;
    mapping(address => uint256) public totalWithdrawnByToken;

    event LockCreated(
        uint256 indexed lockId,
        address indexed token,
        address indexed owner,
        address beneficiary,
        uint256 amount,
        uint256 startTime,
        uint256 cliffTime,
        uint256 endTime,
        uint256 vestingInterval,
        bool isVesting,
        bool isLpToken,
        string metadataURI
    );
    event LockExtended(uint256 indexed lockId, uint256 oldEndTime, uint256 newEndTime);
    event LockAmountIncreased(uint256 indexed lockId, uint256 addedAmount, uint256 newAmount);
    event LockOwnershipTransferred(uint256 indexed lockId, address indexed previousOwner, address indexed newOwner);
    event LockPermanentlyLocked(uint256 indexed lockId, address indexed owner);
    event Withdrawn(uint256 indexed lockId, address indexed beneficiary, uint256 amount);
    event FeeCollected(uint256 indexed lockId, address indexed payer, uint256 amount);
    event FeeDistributed(uint256 indexed lockId, address indexed founderRecipient, address indexed communityRecipient, uint256 founderAmount, uint256 communityAmount);
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientsUpdated(address indexed founderRecipient, address indexed communityRecipient);
    event FeeSplitUpdated(uint16 oldFounderShareBps, uint16 newFounderShareBps);

    modifier lockExists(uint256 lockId) {
        require(locks[lockId].lockId != 0, "Lock does not exist");
        _;
    }

    modifier onlyLockOwner(uint256 lockId) {
        require(locks[lockId].owner == msg.sender, "Not lock owner");
        _;
    }

    constructor(
        uint256 fee,
        uint256 maxFee,
        address initialOwner,
        address payable initialFounderFeeRecipient,
        address payable initialCommunityFeeRecipient,
        uint16 initialFounderFeeShareBps,
        uint16 initialMaxFounderFeeShareBps
    ) Ownable(initialOwner) {
        require(fee <= maxFee, "Fee above max");
        require(initialFounderFeeRecipient != address(0), "Zero founder recipient");
        require(initialCommunityFeeRecipient != address(0), "Zero community recipient");
        require(initialFounderFeeShareBps <= initialMaxFounderFeeShareBps, "Split above max");
        require(initialMaxFounderFeeShareBps <= BPS_DENOMINATOR, "Invalid max split");

        creationFee = fee;
        maxCreationFee = maxFee;
        founderFeeRecipient = initialFounderFeeRecipient;
        communityFeeRecipient = initialCommunityFeeRecipient;
        founderFeeShareBps = initialFounderFeeShareBps;
        maxFounderFeeShareBps = initialMaxFounderFeeShareBps;
    }

    function createCliffLock(
        address token,
        address beneficiary,
        uint256 amount,
        uint256 unlockTime,
        bool isLpToken,
        string calldata metadataURI
    ) external payable nonReentrant returns (uint256 lockId) {
        require(unlockTime >= block.timestamp + MIN_LOCK_DURATION, "Duration below minimum");

        lockId = _createLock(
            token,
            beneficiary,
            amount,
            unlockTime,
            unlockTime,
            0,
            false,
            isLpToken,
            metadataURI
        );
    }

    function createVestingLock(
        address token,
        address beneficiary,
        uint256 amount,
        uint256 cliffTime,
        uint256 endTime,
        uint256 vestingInterval,
        bool isLpToken,
        string calldata metadataURI
    ) external payable nonReentrant returns (uint256 lockId) {
        require(endTime >= block.timestamp + MIN_LOCK_DURATION, "Duration below minimum");
        require(cliffTime <= endTime, "Cliff after end");
        require(vestingInterval > 0, "Missing vesting interval");

        lockId = _createLock(
            token,
            beneficiary,
            amount,
            cliffTime,
            endTime,
            vestingInterval,
            true,
            isLpToken,
            metadataURI
        );
    }

    function withdraw(uint256 lockId) external nonReentrant lockExists(lockId) {
        Lock storage lock = locks[lockId];
        require(msg.sender == lock.owner || msg.sender == lock.beneficiary, "Not allowed");
        require(!lock.isPermanent, "Permanently locked");

        uint256 claimable = getClaimableAmount(lockId);
        require(claimable > 0, "Nothing claimable");

        lock.withdrawnAmount += claimable;
        totalWithdrawnByToken[lock.token] += claimable;
        totalLockedByToken[lock.token] -= claimable;

        if (lock.withdrawnAmount == lock.amount) {
            activeLocks -= 1;
        }

        IERC20(lock.token).safeTransfer(lock.beneficiary, claimable);
        emit Withdrawn(lockId, lock.beneficiary, claimable);
    }

    function extendLock(uint256 lockId, uint256 newEndTime) external lockExists(lockId) onlyLockOwner(lockId) {
        Lock storage lock = locks[lockId];
        require(!lock.isPermanent, "Permanently locked");
        require(newEndTime > lock.endTime, "Can only extend");

        uint256 oldEndTime = lock.endTime;
        lock.endTime = newEndTime;
        if (!lock.isVesting) {
            lock.cliffTime = newEndTime;
        }

        emit LockExtended(lockId, oldEndTime, newEndTime);
    }

    function increaseLockAmount(uint256 lockId, uint256 addedAmount) external nonReentrant lockExists(lockId) onlyLockOwner(lockId) {
        require(addedAmount > 0, "Zero amount");
        Lock storage lock = locks[lockId];
        require(!lock.isPermanent, "Permanently locked");

        lock.amount += addedAmount;
        totalLockedByToken[lock.token] += addedAmount;
        IERC20(lock.token).safeTransferFrom(msg.sender, address(this), addedAmount);

        emit LockAmountIncreased(lockId, addedAmount, lock.amount);
    }

    function transferLockOwnership(uint256 lockId, address newOwner) external lockExists(lockId) onlyLockOwner(lockId) {
        require(newOwner != address(0), "Zero owner");
        Lock storage lock = locks[lockId];
        address previousOwner = lock.owner;
        lock.owner = newOwner;
        userLocks[newOwner].push(lockId);

        emit LockOwnershipTransferred(lockId, previousOwner, newOwner);
    }

    function permanentLock(uint256 lockId) external lockExists(lockId) onlyLockOwner(lockId) {
        Lock storage lock = locks[lockId];
        require(!lock.isPermanent, "Already permanent");
        lock.isPermanent = true;
        permanentLocks += 1;

        emit LockPermanentlyLocked(lockId, msg.sender);
    }

    function setCreationFee(uint256 newFee) external onlyOwner {
        require(newFee <= maxCreationFee, "Fee above max");
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit CreationFeeUpdated(oldFee, newFee);
    }

    function setFeeRecipients(address payable newFounderFeeRecipient, address payable newCommunityFeeRecipient) external onlyOwner {
        require(newFounderFeeRecipient != address(0), "Zero founder recipient");
        require(newCommunityFeeRecipient != address(0), "Zero community recipient");
        founderFeeRecipient = newFounderFeeRecipient;
        communityFeeRecipient = newCommunityFeeRecipient;
        emit FeeRecipientsUpdated(newFounderFeeRecipient, newCommunityFeeRecipient);
    }

    function setFounderFeeShareBps(uint16 newFounderFeeShareBps) external onlyOwner {
        require(newFounderFeeShareBps <= maxFounderFeeShareBps, "Split above max");
        uint16 oldFounderShareBps = founderFeeShareBps;
        founderFeeShareBps = newFounderFeeShareBps;
        emit FeeSplitUpdated(oldFounderShareBps, newFounderFeeShareBps);
    }

    function totalLocks() external view returns (uint256) {
        return nextLockId - 1;
    }

    function totalActiveLocks() external view returns (uint256) {
        return activeLocks;
    }

    function totalPermanentLocks() external view returns (uint256) {
        return permanentLocks;
    }

    function getLock(uint256 lockId) external view lockExists(lockId) returns (Lock memory) {
        return locks[lockId];
    }

    function getUserLocks(address user) external view returns (uint256[] memory) {
        return userLocks[user];
    }

    function getTokenLocks(address token) external view returns (uint256[] memory) {
        return tokenLocks[token];
    }

    function getClaimableAmount(uint256 lockId) public view lockExists(lockId) returns (uint256) {
        Lock memory lock = locks[lockId];
        if (lock.isPermanent || block.timestamp < lock.cliffTime) {
            return 0;
        }

        if (!lock.isVesting) {
            return lock.amount - lock.withdrawnAmount;
        }

        if (block.timestamp >= lock.endTime) {
            return lock.amount - lock.withdrawnAmount;
        }

        uint256 elapsed = block.timestamp - lock.startTime;
        uint256 duration = lock.endTime - lock.startTime;
        uint256 vestedIntervals = elapsed / lock.vestingInterval;
        uint256 intervalSeconds = vestedIntervals * lock.vestingInterval;
        uint256 vestedAmount = (lock.amount * intervalSeconds) / duration;

        if (vestedAmount <= lock.withdrawnAmount) {
            return 0;
        }

        return vestedAmount - lock.withdrawnAmount;
    }

    function getRemainingLockedAmount(uint256 lockId) external view lockExists(lockId) returns (uint256) {
        Lock memory lock = locks[lockId];
        return lock.amount - lock.withdrawnAmount - getClaimableAmount(lockId);
    }

    function _createLock(
        address token,
        address beneficiary,
        uint256 amount,
        uint256 cliffTime,
        uint256 endTime,
        uint256 vestingInterval,
        bool isVesting,
        bool isLpToken,
        string calldata metadataURI
    ) private returns (uint256 lockId) {
        require(msg.value == creationFee, "Invalid fee");
        require(token != address(0), "Zero token");
        require(beneficiary != address(0), "Zero beneficiary");
        require(amount > 0, "Zero amount");

        lockId = nextLockId++;
        locks[lockId] = Lock({
            lockId: lockId,
            token: token,
            owner: msg.sender,
            beneficiary: beneficiary,
            amount: amount,
            withdrawnAmount: 0,
            startTime: block.timestamp,
            cliffTime: cliffTime,
            endTime: endTime,
            vestingInterval: vestingInterval,
            isVesting: isVesting,
            isLpToken: isLpToken,
            isPermanent: false,
            createdAt: block.timestamp,
            metadataURI: metadataURI
        });

        userLocks[msg.sender].push(lockId);
        tokenLocks[token].push(lockId);
        totalLockedByToken[token] += amount;
        activeLocks += 1;
        totalFeesCollected += msg.value;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _distributeFee(lockId, msg.value);

        emit FeeCollected(lockId, msg.sender, msg.value);
        emit LockCreated(
            lockId,
            token,
            msg.sender,
            beneficiary,
            amount,
            block.timestamp,
            cliffTime,
            endTime,
            vestingInterval,
            isVesting,
            isLpToken,
            metadataURI
        );
    }

    function _distributeFee(uint256 lockId, uint256 feeAmount) private {
        if (feeAmount == 0) {
            emit FeeDistributed(lockId, founderFeeRecipient, communityFeeRecipient, 0, 0);
            return;
        }

        uint256 founderAmount = (feeAmount * founderFeeShareBps) / BPS_DENOMINATOR;
        uint256 communityAmount = feeAmount - founderAmount;

        if (founderAmount > 0) {
            (bool founderPaid, ) = founderFeeRecipient.call{value: founderAmount}("");
            require(founderPaid, "Founder fee transfer failed");
        }
        if (communityAmount > 0) {
            (bool communityPaid, ) = communityFeeRecipient.call{value: communityAmount}("");
            require(communityPaid, "Community fee transfer failed");
        }

        emit FeeDistributed(lockId, founderFeeRecipient, communityFeeRecipient, founderAmount, communityAmount);
    }
}
