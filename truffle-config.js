const HDWalletProvider = require('truffle-hdwallet-provider');
const config = require('./config');

module.exports = {
  contracts_build_directory: "./build/contracts",
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },

    ropsten: {
      provider: () => new HDWalletProvider("88BAEA1C45C1434E494604F48A39EEDB780BA71086D109B78CC3B7D41AA49773", `https://ropsten.infura.io/v3/c3300b22863e4d22afc805b901d8f7fe`),
      network_id: 3,       // Ropsten's idc3300b22863e4d22afc805b901d8f7fe
      gas: 5500000,        // Ropsten has a lower block limit than mainnet
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    },

    // Useful for private networks
    private: {
      provider: () => new HDWalletProvider(config.private_key, `https://rpc-mumbai.matic.today`),
      production: true,    // Treats this network as if it was a public net. (default: false)
      network_id: "*",
      skipDryRun: true
    }
  },
  mocha: {
    enableTimeouts: false,
    before_timeout: 120000000 // Here is 2min but can be whatever timeout is suitable for you.
  }
};
