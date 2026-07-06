import { config as loadEnv } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

loadEnv();

const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true
    }
  },
  networks: {
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL || "",
      chainId: 1,
      accounts
    },
    base: {
      url: process.env.BASE_RPC_URL || "",
      chainId: 8453,
      accounts
    },
    bsc: {
      url: process.env.BSC_RPC_URL || "",
      chainId: 56,
      accounts
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    }
  }
};

export default config;
