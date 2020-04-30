const HDWalletProvider = require('truffle-hdwallet-provider');

module.exports = {

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
            provider: () => new HDWalletProvider("24C4FE6063E62710EAD956611B71825B778B041B18ED53118CE5DA5F02E494BA", `https://testnetv3.matic.network`),
            production: true,    // Treats this network as if it was a public net. (default: false)
            network_id: "*",
            gasPrice: 0,
            skipDryRun: true
        }
    },

    // Set default mocha options here, use special reporters etc.
    mocha:
        {
            // timeout: 100000
        }
    ,

// Configure your compilers
    compilers: {
        solc: {
            // version: "0.5.1",    // Fetch exact version from solc-bin (default: truffle's version)
            // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
            // settings: {          // See the solidity docs for advice about optimization and evmVersion
            //  optimizer: {
            //    enabled: false,
            //    runs: 200
            //  },
            //  evmVersion: "byzantium"
            // }
        }
    }
}
;
