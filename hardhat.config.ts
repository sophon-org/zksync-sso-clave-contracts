import "@typechain/hardhat";
import "@matterlabs/hardhat-zksync";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import "./scripts/deploy";
import "./scripts/publish";
import "./scripts/upgrade";
import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const config: HardhatUserConfig = {
  paths: {
    sources: "src",
    deployPaths: "scripts",
  },
  defaultNetwork: "inMemoryNode",
  networks: {
    zkSyncSepoliaTestnet: {
      url: "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia",
      zksync: true,
      verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
    },
    zkSyncMainnet: {
      url: "https://mainnet.era.zksync.io",
      ethNetwork: "mainnet",
      zksync: true,
      verifyURL: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
    },
    sophonTestnet: {
      url: "https://rpc.testnet.sophon.xyz",
      ethNetwork: "sepolia",
      zksync: true,
      verifyURL: "https://api-explorer-verify.testnet.sophon.xyz/contract_verification",
    },
    sophonMainnet: {
      url: "https://rpc.sophon.xyz",
      ethNetwork: "mainnet",
      zksync: true,
      verifyURL: "https://verification-explorer.sophon.xyz/contract_verification",
    },
    dockerizedNode: {
      url: "http://localhost:3050",
      ethNetwork: "http://localhost:8545",
      zksync: true,
    },
    inMemoryNode: {
      url: "http://127.0.0.1:8011",
      ethNetwork: "localhost", // in-memory node doesn't support eth node; removing this line will cause an error
      zksync: true,
    },
    demoNode: {
      url: "https://node.nvillanueva.com",
      ethNetwork: "localhost", // in-memory node doesn't support eth node; removing this line will cause an error
      zksync: true,
    },
    hardhat: {
      zksync: true,
    },
  },
  /*etherscan: {
    apiKey: {
      sophonTestnet: process.env.SOPHON_TESTNET_API_KEY,
      sophonMainnet: process.env.SOPHON_MAINNET_API_KEY
    },
    customChains: [
      {
        network: "sophonTestnet",
        chainId: 531050104,
        urls: {
          apiURL: "https://api-sepolia.sophscan.xyz/api",
          browserURL: "https://testnet.sophscan.xyz/"
        }
      },
      {
        network: "sophonMainnet",
        chainId: 50104,
        urls: {
          apiURL: "https://api.sophscan.xyz/api",
          browserURL: "https://sophscan.xyz/"
        }
      }
    ]
  },*/
  zksolc: {
    version: "1.5.11",
    settings: {
      // https://era.zksync.io/docs/tools/hardhat/hardhat-zksync-solc.html#configuration
      // Native AA calls an internal system contract, so it needs extra permissions
      enableEraVMExtensions: true,
    },
  },
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      codegen: "yul",
    },
  },
};

export default config;
