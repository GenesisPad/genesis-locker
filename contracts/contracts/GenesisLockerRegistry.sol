// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title GenesisLockerRegistry
/// @notice Unified index of Genesis Locker assets across internal locker contracts. Stores
/// raw on-chain lock facts only - USD/TVL valuation is deliberately left to the off-chain
/// indexer/backend (see genesis-locker/api), which already computes ERC20/LP/position value
/// and accrued fees separately.
///
/// Scope note: only GenesisV3PositionLocker reports into this registry automatically as of
/// this milestone. The existing, already-deployed GenesisLocker.sol (ERC20/LP locker, live at
/// locker.genesispad.app) is deliberately left unmodified - Requirement 3 explicitly allows
/// "reuse the existing deployed contract...do not force existing users to migrate unless
/// necessary." Its locks remain tracked by its own on-chain state (lockCount/getLock) plus the
/// existing off-chain indexer. Wiring it into this registry as an on-chain reporter (via a new
/// deployed version, since the live contract can't be modified after the fact) is a documented
/// follow-up, not implemented here to avoid touching production/audited code.
contract GenesisLockerRegistry is Ownable {
    enum LockAssetType {
        ERC20,
        ERC20_LP,
        V3_POSITION
    }

    error ZeroAddress();
    error NotAuthorizedLocker();
    error NotRegisteredBy();
    error LockNotFound();

    struct LockEntry {
        uint256 lockId;
        LockAssetType assetType;
        address locker;
        address tokenOrPositionManager;
        uint256 amountOrTokenId;
        address depositor;
        address beneficiary;
        bool permanent;
        uint64 unlockTime;
        uint64 createdAt;
        bool active;
    }

    event AuthorizedLockerSet(address indexed locker, bool authorized);
    event LockRegistered(
        uint256 indexed lockId,
        LockAssetType indexed assetType,
        address indexed locker,
        address tokenOrPositionManager,
        uint256 amountOrTokenId
    );
    event LockDeactivated(uint256 indexed lockId);

    mapping(address => bool) public authorizedLockers;
    mapping(uint256 => LockEntry) private _locks;
    uint256 public nextLockId = 1;

    constructor(address owner_) Ownable(owner_) {}

    function setAuthorizedLocker(address locker, bool authorized) external onlyOwner {
        if (locker == address(0)) revert ZeroAddress();
        authorizedLockers[locker] = authorized;
        emit AuthorizedLockerSet(locker, authorized);
    }

    function registerLock(
        LockAssetType assetType,
        address tokenOrPositionManager,
        uint256 amountOrTokenId,
        address depositor,
        address beneficiary,
        bool permanent,
        uint64 unlockTime
    ) external returns (uint256 lockId) {
        if (!authorizedLockers[msg.sender]) revert NotAuthorizedLocker();

        lockId = nextLockId++;
        _locks[lockId] = LockEntry({
            lockId: lockId,
            assetType: assetType,
            locker: msg.sender,
            tokenOrPositionManager: tokenOrPositionManager,
            amountOrTokenId: amountOrTokenId,
            depositor: depositor,
            beneficiary: beneficiary,
            permanent: permanent,
            unlockTime: unlockTime,
            createdAt: uint64(block.timestamp),
            active: true
        });

        emit LockRegistered(lockId, assetType, msg.sender, tokenOrPositionManager, amountOrTokenId);
    }

    /// @notice Only the same locker contract that registered a lock may mark it inactive
    /// (e.g. after a legitimate timed-lock withdrawal on a non-permanent lock type).
    function deactivateLock(uint256 lockId) external {
        LockEntry storage entry = _locks[lockId];
        if (entry.createdAt == 0) revert LockNotFound();
        if (entry.locker != msg.sender) revert NotRegisteredBy();
        entry.active = false;
        emit LockDeactivated(lockId);
    }

    function getLock(uint256 lockId) external view returns (LockEntry memory) {
        return _locks[lockId];
    }
}
