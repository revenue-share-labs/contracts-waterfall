import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
    ],
  },
  networks: {
    gorli: {
      url: "https://goerli.infura.io/v3/" + process.env.INFURA_GORLI_RPC_KEY,
      chainId: 5,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    mainnet: {
      url: "https://ethereum.publicnode.com",
      chainId: 1,
      accounts:
        process.env.PRIVATE_KEY_MAINNET !== undefined
          ? [process.env.PRIVATE_KEY_MAINNET]
          : [],
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./tests",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPriceApi: "https://api.bscscan.com/api?module=proxy&action=eth_gasPrice",
    coinmarketcap: process.env.CMC_KEY,
    token: "ETH",
  },
};

export default config;
