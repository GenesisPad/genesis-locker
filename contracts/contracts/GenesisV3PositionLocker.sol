// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {INonfungiblePositionManagerMinimal as INonfungiblePositionManager} from "./interfaces/INonfungiblePositionManagerMinimal.sol";
import {IUniswapV3Factory} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";

interface IGenesisFeeDistributionRegistry {
    function isActiveDistributor(address distributor) external view returns (bool);
}

interface IGenesisLockerRegistryReporter {
    function registerLock(
        uint8 assetType,
        address tokenOrPositionManager,
        uint256 amountOrTokenId,
        address depositor,
        address beneficiary,
        bool permanent,
        uint64 unlockTime
    ) external returns (uint256 lockId);
}

/// @title GenesisV3PositionLocker
/// @notice Internal component of the universal Genesis Locker product (never presented to
/// users as a separate product). Receives and permanently holds GenesisPad-created Uniswap
/// V3 position NFTs. Permits fee collection (to GenesisFeeDistributor only); permits nothing
/// else. There is no function anywhere in this contract - reachable by owner, factory,
/// creator, or anyone else - that can transfer, approve, decrease liquidity, burn, migrate,
/// or otherwise move a registered permanent position out of this contract.
contract GenesisV3PositionLocker is IERC721Receiver, Ownable, ReentrancyGuard {
    error ZeroAddress();
    error AlreadySet();
    error NotLaunchFactory();
    error NotFeeDistributor();
    error PositionManagerNotApproved();
    error OperatorNotLaunchFactory();
    error NoPendingDeposit();
    error AlreadyLocked();
    error PositionMismatch();
    error ZeroLiquidity();
    error LiquidityInvariantViolated();
    error PositionIsRegistered();
    error LockNotFound();

    struct PositionLock {
        address positionManager;
        uint256 tokenId;
        address launchToken;
        address pairedAsset;
        address pool;
        address originalDepositor;
        address beneficiary;
        uint128 initialLiquidity;
        uint64 lockedAt;
        uint64 unlockTime;
        bool permanent;
        bool registeredGenesisLaunch;
        bool withdrawn;
    }

    event ApprovedPositionManagerSet(address indexed positionManager, bool approved);
    event LaunchFactorySet(address indexed launchFactory);
    event FeeDistributionRegistrySet(address indexed registry);
    event PositionReceived(address indexed positionManager, uint256 indexed tokenId, address indexed operator);
    event PositionLockCreated(
        address indexed positionManager,
        uint256 indexed tokenId,
        address indexed launchToken,
        address pairedAsset,
        address pool,
        uint128 initialLiquidity
    );
    event FeesCollected(
        address indexed positionManager,
        uint256 indexed tokenId,
        uint256 amount0,
        uint256 amount1,
        address recipient
    );
    event UnrelatedNftRescued(address indexed nftContract, uint256 indexed tokenId, address indexed to);

    /// @notice Authorized launch orchestrator. Settable exactly once (one-way, mirrors
    /// GenesisLaunchRegistry's pattern) - the deposit-acceptance check (`operator == launchFactory`)
    /// would otherwise be an admin-swappable backdoor if this were freely mutable.
    address public launchFactory;
    /// @notice Registry that authorizes the active fee distributor allowed to collect fees.
    address public immutable feeDistributionRegistry;
    /// @notice GenesisLockerRegistry - the unified cross-locker index. Settable once (same
    /// one-way pattern); reported to (best-effort) whenever a position is locked.
    address public lockerRegistry;
    /// @notice Uniswap V3 position-manager contracts this locker will accept deposits from.
    mapping(address => bool) public approvedPositionManagers;

    /// @dev Positions received via onERC721Received but not yet confirmed+locked via
    /// lockGenesisLaunchPosition. Only the launch factory can move a pending deposit into a
    /// confirmed PositionLock, and only for the exact tokenId it just minted to this contract.
    mapping(address positionManager => mapping(uint256 tokenId => bool pending)) public pendingDeposit;

    mapping(address positionManager => mapping(uint256 tokenId => PositionLock)) private _locks;

    constructor(address owner_, address feeDistributionRegistry_) Ownable(owner_) {
        if (feeDistributionRegistry_ == address(0)) revert ZeroAddress();
        feeDistributionRegistry = feeDistributionRegistry_;
        emit FeeDistributionRegistrySet(feeDistributionRegistry_);
    }

    function setApprovedPositionManager(address positionManager, bool approved) external onlyOwner {
        if (positionManager == address(0)) revert ZeroAddress();
        approvedPositionManagers[positionManager] = approved;
        emit ApprovedPositionManagerSet(positionManager, approved);
    }

    function setLaunchFactory(address factory_) external onlyOwner {
        if (launchFactory != address(0)) revert AlreadySet();
        if (factory_ == address(0)) revert ZeroAddress();
        launchFactory = factory_;
        emit LaunchFactorySet(factory_);
    }

    function setLockerRegistry(address lockerRegistry_) external onlyOwner {
        if (lockerRegistry != address(0)) revert AlreadySet();
        if (lockerRegistry_ == address(0)) revert ZeroAddress();
        lockerRegistry = lockerRegistry_;
    }

    /// @notice ERC721 receiver hook. Deliberately minimal (no external calls beyond the
    /// approved-position-manager/operator checks) - the full position-detail verification
    /// happens explicitly afterward in lockGenesisLaunchPosition, called by the same launch
    /// transaction. Rejects anything not approved-position-manager + launch-factory-initiated.
    function onERC721Received(
        address operator,
        address /* from */,
        uint256 tokenId,
        bytes calldata /* data */
    ) external override returns (bytes4) {
        if (!approvedPositionManagers[msg.sender]) revert PositionManagerNotApproved();
        if (operator != launchFactory) revert OperatorNotLaunchFactory();

        pendingDeposit[msg.sender][tokenId] = true;
        emit PositionReceived(msg.sender, tokenId, operator);
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Confirms and permanently locks a just-received GenesisPad launch position.
    /// Callable only by the launch factory, only for a tokenId this contract actually holds
    /// and marked pending, and only after independently verifying (via the position manager
    /// and the canonical V3 factory) that the on-chain position genuinely matches every
    /// expected parameter - see "Required verification during deposit" in the spec.
    function lockGenesisLaunchPosition(
        address positionManager,
        uint256 tokenId,
        address expectedToken0,
        address expectedToken1,
        uint24 expectedFee,
        int24 expectedTickLower,
        int24 expectedTickUpper,
        address expectedPool,
        address originalDepositor,
        address beneficiary
    ) external nonReentrant returns (uint128 liquidity) {
        if (msg.sender != launchFactory) revert NotLaunchFactory();
        if (!pendingDeposit[positionManager][tokenId]) revert NoPendingDeposit();
        if (_locks[positionManager][tokenId].lockedAt != 0) revert AlreadyLocked();

        // 1. Confirm the NFT is genuinely owned by this locker after transfer.
        if (IERC721(positionManager).ownerOf(tokenId) != address(this)) revert PositionMismatch();

        // 2-6. Read the V3 position and confirm token pair, fee tier, tick range, and liquidity.
        (
            ,
            ,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 posLiquidity,
            ,
            ,
            ,

        ) = INonfungiblePositionManager(positionManager).positions(tokenId);

        if (token0 != expectedToken0 || token1 != expectedToken1) revert PositionMismatch();
        if (fee != expectedFee) revert PositionMismatch();
        if (tickLower != expectedTickLower || tickUpper != expectedTickUpper) revert PositionMismatch();
        if (posLiquidity == 0) revert ZeroLiquidity();

        // 7. Confirm the position corresponds to the expected canonical pool.
        address factory = INonfungiblePositionManager(positionManager).factory();
        address canonicalPool = IUniswapV3Factory(factory).getPool(token0, token1, fee);
        if (canonicalPool != expectedPool) revert PositionMismatch();

        pendingDeposit[positionManager][tokenId] = false;

        address launchToken = expectedToken0;
        address pairedAsset = expectedToken1;

        _locks[positionManager][tokenId] = PositionLock({
            positionManager: positionManager,
            tokenId: tokenId,
            launchToken: launchToken,
            pairedAsset: pairedAsset,
            pool: expectedPool,
            originalDepositor: originalDepositor,
            beneficiary: beneficiary,
            initialLiquidity: posLiquidity,
            lockedAt: uint64(block.timestamp),
            unlockTime: 0, // permanent sentinel
            permanent: true,
            registeredGenesisLaunch: true,
            withdrawn: false
        });

        emit PositionLockCreated(positionManager, tokenId, launchToken, pairedAsset, expectedPool, posLiquidity);

        if (lockerRegistry != address(0)) {
            // Best-effort unified indexing - never allowed to block or revert the core lock.
            try
                IGenesisLockerRegistryReporter(lockerRegistry).registerLock(
                    2, // LockAssetType.V3_POSITION
                    positionManager,
                    tokenId,
                    originalDepositor,
                    beneficiary,
                    true,
                    0
                )
            {} catch {}
        }

        return posLiquidity;
    }

    /// @notice Collects accrued fees for a registered permanent position, sending them
    /// directly to GenesisFeeDistributor (never to this contract, never to the caller).
    /// Reverts if post-collection liquidity ever falls below the recorded initial liquidity -
    /// an invariant that should be structurally impossible to violate (this contract has no
    /// path to decrease real liquidity at all), kept as a defense-in-depth check.
    ///
    /// Does NOT call decreaseLiquidity(0) as a "poke" before collecting - the real
    /// NonfungiblePositionManager.decreaseLiquidity requires `liquidity > 0` (confirmed
    /// empirically against the real contract; it reverts on a literal zero), so that pattern
    /// is not actually available here. This is not needed anyway: collect() itself already
    /// refreshes and returns the position's up-to-date accrued fees directly, verified in this
    /// milestone's tests against real post-swap fee accrual.
    function collectFees(
        address positionManager,
        uint256 tokenId
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        if (!IGenesisFeeDistributionRegistry(feeDistributionRegistry).isActiveDistributor(msg.sender)) {
            revert NotFeeDistributor();
        }
        PositionLock storage lock = _locks[positionManager][tokenId];
        if (lock.lockedAt == 0) revert LockNotFound();

        (amount0, amount1) = INonfungiblePositionManager(positionManager).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: msg.sender,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        (, , , , , , , uint128 liquidityAfter, , , , ) = INonfungiblePositionManager(positionManager).positions(
            tokenId
        );
        if (liquidityAfter < lock.initialLiquidity) revert LiquidityInvariantViolated();

        emit FeesCollected(positionManager, tokenId, amount0, amount1, msg.sender);
    }

    /// @notice Recovery for NFTs accidentally sent to this contract OUTSIDE the
    /// onERC721Received-confirm-lock flow above (e.g. a raw ERC721 `transferFrom`, which does
    /// not invoke onERC721Received at all, or a different NFT contract entirely). Cannot ever
    /// touch a registered permanent position: reverts if the token ID is referenced by any
    /// lock record, and only ever transfers the exact NFT specified (no arbitrary calls).
    function rescueUnrelatedNft(address nftContract, uint256 tokenId, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (_locks[nftContract][tokenId].lockedAt != 0) revert PositionIsRegistered();
        IERC721(nftContract).safeTransferFrom(address(this), to, tokenId);
        emit UnrelatedNftRescued(nftContract, tokenId, to);
    }

    function isPermanentlyLockedGenesisLaunch(address positionManager, uint256 tokenId) external view returns (bool) {
        PositionLock storage lock = _locks[positionManager][tokenId];
        return lock.lockedAt != 0 && lock.permanent && lock.registeredGenesisLaunch && !lock.withdrawn;
    }

    function getLock(address positionManager, uint256 tokenId) external view returns (PositionLock memory) {
        return _locks[positionManager][tokenId];
    }
}
