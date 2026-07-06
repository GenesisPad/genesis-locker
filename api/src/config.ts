import "dotenv/config";

const configuredChains = [
  {
    id: 1, name: "Ethereum", symbol: "ETH",
    rpcEnvKey: "ETHEREUM_RPC_URL", rpcUrl: process.env.ETHEREUM_RPC_URL,
    lockerAddress: process.env.ETHEREUM_LOCKER_ADDRESS,
    fee: "0.01", explorerUrl: "https://etherscan.io",
    dotColor: "#627EEA", geckoTerminalId: "eth", feeLabel: "0.01 ETH",
  },
  {
    id: 8453, name: "Base", symbol: "ETH",
    rpcEnvKey: "BASE_RPC_URL", rpcUrl: process.env.BASE_RPC_URL,
    lockerAddress: process.env.BASE_LOCKER_ADDRESS,
    fee: "0.01", explorerUrl: "https://basescan.org",
    dotColor: "#0052FF", geckoTerminalId: "base", feeLabel: "0.01 ETH",
  },
  {
    id: 56, name: "BNB Chain", symbol: "BNB",
    rpcEnvKey: "BSC_RPC_URL", rpcUrl: process.env.BSC_RPC_URL,
    lockerAddress: process.env.BSC_LOCKER_ADDRESS,
    fee: "0.03", explorerUrl: "https://bscscan.com",
    dotColor: "#F3BA2F", geckoTerminalId: "bsc", feeLabel: "0.03 BNB",
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
  } as const] : [])
] as const;

export const port = Number(process.env.PORT || 4010);
export const lowLockPercentageThreshold = 60;
export const shortLockDays = 30;
export const indexerBatchSize = Number(process.env.INDEXER_BATCH_SIZE || 2_000);
export const indexerConfirmations = Number(process.env.INDEXER_CONFIRMATIONS || 12);
