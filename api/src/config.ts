import "dotenv/config";

const configuredChains = [
  {
    id: 4663, name: "Robinhood Chain", symbol: "ETH",
    rpcEnvKey: "ROBINHOOD_RPC_URL", rpcUrl: process.env.ROBINHOOD_RPC_URL,
    lockerAddress: process.env.ROBINHOOD_LOCKER_ADDRESS,
    fee: "0.01", explorerUrl: "https://robinhoodchain.blockscout.com",
    dotColor: "#d9ad4a", geckoTerminalId: null, feeLabel: "0.01 ETH",
    // Canonical wrapped-native token address, used to price LP pairs by reserve
    // ratio (one side of the pool is this token, priced against native USD).
    wrappedNativeAddress: process.env.ROBINHOOD_WETH_ADDRESS || "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  },
  {
    id: 1, name: "Ethereum", symbol: "ETH",
    rpcEnvKey: "ETHEREUM_RPC_URL", rpcUrl: process.env.ETHEREUM_RPC_URL,
    lockerAddress: process.env.ETHEREUM_LOCKER_ADDRESS,
    fee: "0.01", explorerUrl: "https://etherscan.io",
    dotColor: "#627EEA", geckoTerminalId: "eth", feeLabel: "0.01 ETH",
    wrappedNativeAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  {
    id: 8453, name: "Base", symbol: "ETH",
    rpcEnvKey: "BASE_RPC_URL", rpcUrl: process.env.BASE_RPC_URL,
    lockerAddress: process.env.BASE_LOCKER_ADDRESS,
    fee: "0.01", explorerUrl: "https://basescan.org",
    dotColor: "#0052FF", geckoTerminalId: "base", feeLabel: "0.01 ETH",
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
  },
  {
    id: 56, name: "BNB Chain", symbol: "BNB",
    rpcEnvKey: "BSC_RPC_URL", rpcUrl: process.env.BSC_RPC_URL,
    lockerAddress: process.env.BSC_LOCKER_ADDRESS,
    fee: "0.03", explorerUrl: "https://bscscan.com",
    dotColor: "#F3BA2F", geckoTerminalId: "bsc", feeLabel: "0.03 BNB",
    wrappedNativeAddress: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
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
    fee: "0.01",
    explorerUrl: "http://localhost:8545",
    dotColor: "#22c55e",
    geckoTerminalId: null,
    feeLabel: "0.01 ETH",
    wrappedNativeAddress: process.env.LOCAL_WETH_ADDRESS || null,
  } as const] : [])
] as const;

export const port = Number(process.env.PORT || 4010);
export const lowLockPercentageThreshold = 60;
export const shortLockDays = 30;
export const indexerBatchSize = Number(process.env.INDEXER_BATCH_SIZE || 2_000);
export const indexerConfirmations = Number(process.env.INDEXER_CONFIRMATIONS || 12);
