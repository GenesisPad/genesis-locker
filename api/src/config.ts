import "dotenv/config";

const configuredChains = [
  {
    id: 4663, name: "Robinhood Chain", symbol: "ETH",
    rpcEnvKey: "ROBINHOOD_RPC_URL", rpcUrl: process.env.ROBINHOOD_RPC_URL,
    lockerAddress: process.env.ROBINHOOD_LOCKER_ADDRESS,
    v3PositionLockerAddress: process.env.ROBINHOOD_V3_POSITION_LOCKER_ADDRESS || "0x9d1838aE9869C1b0c7E76029c97112834ec8b1B5",
    fee: "0.01", explorerUrl: "https://robinhoodchain.blockscout.com",
    dotColor: "#d9ad4a", geckoTerminalId: null, feeLabel: "0.01 ETH",
    // Canonical wrapped-native token address, used to price LP pairs by reserve
    // ratio (one side of the pool is this token, priced against native USD).
    wrappedNativeAddress: process.env.ROBINHOOD_WETH_ADDRESS || "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    // Optional Uniswap V2-compatible factory. When set, plain token locks get
    // priced by looking up their pair against wrappedNativeAddress even if
    // that pair was never itself locked on Genesis Locker. Unset = no guess.
    // Verified on-chain: matches the router GenesisPad's launcher allows
    // (0x89e5DB8B5aA49aA85AC63f691524311AEB649eba).factory(), and
    // factory.getPair(GEN, WETH) returns the same pair address emitted by
    // the launcher's own Listed(token, pair) event for GEN's graduation.
    dexFactoryAddress: process.env.ROBINHOOD_DEX_FACTORY_ADDRESS || "0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f",
    // GenesisPad's bonding-curve launcher. Optional: when set, a token that
    // hasn't graduated to DEX liquidity yet can still be priced from its
    // live virtual reserves instead of showing no price until it lists.
    launcherAddress: process.env.ROBINHOOD_LAUNCHER_ADDRESS || "0x513a87182E03090Bf18B5C2faec03f127fE3eC99",
  },
  {
    id: 1, name: "Ethereum", symbol: "ETH",
    rpcEnvKey: "ETHEREUM_RPC_URL", rpcUrl: process.env.ETHEREUM_RPC_URL,
    lockerAddress: process.env.ETHEREUM_LOCKER_ADDRESS,
    v3PositionLockerAddress: null,
    fee: "0.01", explorerUrl: "https://etherscan.io",
    dotColor: "#627EEA", geckoTerminalId: "eth", feeLabel: "0.01 ETH",
    wrappedNativeAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    dexFactoryAddress: process.env.ETHEREUM_DEX_FACTORY_ADDRESS || null,
    launcherAddress: null,
  },
  {
    id: 8453, name: "Base", symbol: "ETH",
    rpcEnvKey: "BASE_RPC_URL", rpcUrl: process.env.BASE_RPC_URL,
    lockerAddress: process.env.BASE_LOCKER_ADDRESS,
    v3PositionLockerAddress: null,
    fee: "0.01", explorerUrl: "https://basescan.org",
    dotColor: "#0052FF", geckoTerminalId: "base", feeLabel: "0.01 ETH",
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
    dexFactoryAddress: process.env.BASE_DEX_FACTORY_ADDRESS || null,
    launcherAddress: null,
  },
  {
    id: 56, name: "BNB Chain", symbol: "BNB",
    rpcEnvKey: "BSC_RPC_URL", rpcUrl: process.env.BSC_RPC_URL,
    lockerAddress: process.env.BSC_LOCKER_ADDRESS,
    v3PositionLockerAddress: null,
    fee: "0.03", explorerUrl: "https://bscscan.com",
    dotColor: "#F3BA2F", geckoTerminalId: "bsc", feeLabel: "0.03 BNB",
    wrappedNativeAddress: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    dexFactoryAddress: process.env.BSC_DEX_FACTORY_ADDRESS || null,
    launcherAddress: null,
  },
] as const;

export const chains = [
  ...configuredChains,
  ...(process.env.LOCAL_RPC_URL && process.env.LOCAL_LOCKER_ADDRESS ? [{
    id: 31337,
    name: "Local Hardhat",
    symbol: "ETH",
    rpcEnvKey: "LOCAL_RPC_URL",
    rpcUrl: process.env.LOCAL_RPC_URL,
    lockerAddress: process.env.LOCAL_LOCKER_ADDRESS,
    v3PositionLockerAddress: process.env.LOCAL_V3_POSITION_LOCKER_ADDRESS || null,
    fee: "0.01",
    explorerUrl: "http://localhost:8545",
    dotColor: "#22c55e",
    geckoTerminalId: null,
    feeLabel: "0.01 ETH",
    wrappedNativeAddress: process.env.LOCAL_WETH_ADDRESS || null,
    dexFactoryAddress: process.env.LOCAL_DEX_FACTORY_ADDRESS || null,
    launcherAddress: null,
  } as const] : [])
] as const;

export const port = Number(process.env.PORT || 4010);
export const lowLockPercentageThreshold = 60;
export const shortLockDays = 30;
export const indexerBatchSize = Number(process.env.INDEXER_BATCH_SIZE || 2_000);
export const indexerConfirmations = Number(process.env.INDEXER_CONFIRMATIONS || 12);
