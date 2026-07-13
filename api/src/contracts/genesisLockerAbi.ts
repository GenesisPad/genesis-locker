export const genesisLockerAbi = [
  "event LockCreated(uint256 indexed lockId,address indexed token,address indexed owner,address beneficiary,uint256 amount,uint256 startTime,uint256 cliffTime,uint256 endTime,uint256 vestingInterval,bool isVesting,bool isLpToken,string metadataURI)",
  "event LockExtended(uint256 indexed lockId,uint256 oldEndTime,uint256 newEndTime)",
  "event LockAmountIncreased(uint256 indexed lockId,uint256 addedAmount,uint256 newAmount)",
  "event LockOwnershipTransferred(uint256 indexed lockId,address indexed previousOwner,address indexed newOwner)",
  "event LockPermanentlyLocked(uint256 indexed lockId,address indexed owner)",
  "event Withdrawn(uint256 indexed lockId,address indexed beneficiary,uint256 amount)",
  "event FeeCollected(uint256 indexed lockId,address indexed payer,uint256 amount)",
  "event FeeDistributed(uint256 indexed lockId,address indexed founderRecipient,address indexed communityRecipient,uint256 founderAmount,uint256 communityAmount)",
  "event CreationFeeUpdated(uint256 oldFee,uint256 newFee)",
  "event FeeRecipientsUpdated(address indexed founderRecipient,address indexed communityRecipient)",
  "event FeeSplitUpdated(uint16 oldFounderShareBps,uint16 newFounderShareBps)",
  "function owner() view returns (address)",
  "function creationFee() view returns (uint256)",
  "function maxCreationFee() view returns (uint256)",
  "function founderFeeRecipient() view returns (address)",
  "function communityFeeRecipient() view returns (address)",
  "function founderFeeShareBps() view returns (uint16)"
] as const;

export const erc20Abi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)"
] as const;

export const pairAbi = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
] as const;

// Standard Uniswap V2-compatible factory interface, used to discover a
// token's pair against the chain's wrapped-native currency even when that
// pair itself has never been locked on Genesis Locker.
export const factoryAbi = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)"
] as const;

export const genesisV3PositionLockerAbi = [
  "event PositionLockCreated(address indexed positionManager,uint256 indexed tokenId,address indexed launchToken,address pairedAsset,address pool,uint128 initialLiquidity)",
  "event FeesCollected(address indexed positionManager,uint256 indexed tokenId,uint256 amount0,uint256 amount1,address recipient)",
  "function getLock(address positionManager,uint256 tokenId) view returns (tuple(address positionManager,uint256 tokenId,address launchToken,address pairedAsset,address pool,address originalDepositor,address beneficiary,uint128 initialLiquidity,uint64 lockedAt,uint64 unlockTime,bool permanent,bool registeredGenesisLaunch,bool withdrawn))"
] as const;
