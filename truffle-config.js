require('dotenv').config();
const HDWalletProvider = require("@truffle/hdwallet-provider");
const privateKey = process.env.privateKey.trim();
module.exports = {
  networks: {
    dev: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard BSC port (default: none)
      network_id: "*"       // Any network (default: none),
    },
    testnet: {
      provider: () => new HDWalletProvider(
          {
            privateKeys: [privateKey],
            providerOrUrl: "https://data-seed-prebsc-1-s3.binance.org:8545/",
            addressIndex: 0
          }),
      network_id: 97,
      confirmations: 3,
      timeoutBlocks: 200,
      networkCheckTimeout:999999,
      skipDryRun: true
    },
    mainnet: {
      provider: () => new HDWalletProvider(
          {
            privateKeys: [privateKey],
            providerOrUrl: "https://bsc-dataseed1.binance.org",
            addressIndex: 0
          }),
      network_id: 56,
      confirmations: 3,
      timeoutBlocks: 200,
      networkCheckTimeout:999999,
      skipDryRun: true
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  compilers: {
    solc: {
      version: "0.6.12",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    etherscan: process.env.etherscan,
    bscscan: process.env.bscscan
  }
};
