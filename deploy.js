const ethers = require('ethers');
const config = require('./config.json');
const fs = require('fs-extra');
const Web3 = require('web3');
const currentProvider = new Web3.providers.HttpProvider(config.matic);
const provider = new ethers.providers.Web3Provider(currentProvider);

const wallet = new ethers.Wallet(config.private_key, provider);
console.log(`Loaded wallet ${wallet.address}`);

async function deploy(contract_name) {
  let compiled = require(`./build/${contract_name}.json`);
  console.log("Current Gas price:",parseInt(await provider.getGasPrice()));

  console.log(`\nDeploying ${contract_name} in ${config["matic"]}`);
  let contract = new ethers.ContractFactory(
    compiled.abi,
    compiled.bytecode,
    wallet
  );
  let instance = await contract.deploy({ gasPrice: 0});

  console.log(`deployed at ${instance.address}`);
  config[`${contract_name}`] = instance.address;
  console.log("Waiting for the contract to get mined...");
  await instance.deployed();
  console.log("Contract deployed");
  fs.outputJsonSync(
    'config.json',
    config,
    {
      spaces: 2,
      EOL: "\n"
    }
  );

}

(async () => {
  await deploy("NewfangDIDRegistry");
})().catch(err => {
  console.error(err);
});
