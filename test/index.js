const assert = require('assert');
const ethers = require('ethers');
const config = require('../config.json');

const ganache = require('ganache-cli');
const fs = require('fs');

const provider = new ethers.providers.Web3Provider(ganache.provider({gasLimit: 8000000}));

const newfangJson = require('../build/contracts/Skizzle.json');

let wallet,
  newfangDID,
  accounts,
  wallet1 = new ethers.Wallet(config.private_key);

let gasFees = {};
let IDs = [
  '0x4de0e96b0a8886e42a2c35b57df8a9d58a93b5bff655bc37a30e2ab8e29dc066',
  '0x3d725c5ee53025f027da36bea8d3af3b6a3e9d2d1542d47c162631de48e66c1c',
  '0x967f2a2c7f3d22f9278175c1e6aa39cf9171db91dceacd5ee0f37c2e507b5abe',
  '0x6e65772069640000000000000000000000000000000000000000000000000000'
];

let AccessTypes = {
  read: ethers.utils.formatBytes32String('read'),
  reshare: ethers.utils.formatBytes32String('reshare'),
  delete: ethers.utils.formatBytes32String('delete')
};

function updateGas(key, value) {
  gasFees[key] = value;
  fs.writeFileSync('gas.json', JSON.stringify(gasFees));
}

function hash(address) {
  let payload = ethers.utils.defaultAbiCoder.encode(['address'], [address]);
  return ethers.utils.keccak256(payload);
}

describe('Ganache Setup', async () => {
  it('initiates ganache and generates a bunch of demo accounts', async () => {
    accounts = await provider.listAccounts();
    wallet = provider.getSigner(accounts[0]);
    assert.ok(accounts.length >= 2, 'atleast 2 accounts should be present in the array');
  });
});

describe('Contract initialization, DID creation', async () => {
  it('Deploying the contract', async () => {
    const newfangContract = new ethers.ContractFactory(newfangJson.abi, newfangJson.bytecode, wallet);
    newfangDID = await newfangContract.deploy();
    await newfangDID.deployed();

    let nodes = [
      '0x85dC57e32ce816d733D184252140E5230292b236',
      '0x058ed96E9e02fbe6a1b7b04d4dA1E529841187E1',
      '0xA0013c6B1576cC482C03d108Cb51c03467cA86aC',
      '0xf5d37b2681D0A867849A33b1c4C656086962b2F0',
      '0x2BBF87A6B75D20DF4C5666b76c1d21f3563dB87a',
      '0x9D719DE41003f2BAE4c5a04cb33B435a68Ee13af'
    ];

    let tx = await newfangDID.functions.initialize(nodes);
    await tx.wait();
    assert.ok(newfangDID.address, 'Newfang DID  Register deployed');
  });

  it('Add nodes', async () => {
    let total_nodes = 6;
    for (let i = 0; i < total_nodes; i++) {
      let tx = await newfangDID.addNode(accounts[i]);
      await tx.wait();
    }
  });
});

describe('CRUD', async () => {
  it('Create', async () => {
    let doc = ethers.utils.formatBytes32String('hash of document');
    let fph = ethers.utils.formatBytes32String('');
    let size = 1200, nonce = new Date().getTime();
    let payload = ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'uint256', 'bytes32', 'uint256'],
      [IDs[0], doc, size, fph, nonce]
    );
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let gas = await newfangDID.estimate.createSigned(
      IDs[0],
      doc,
      size,
      fph,
      nonce,
      accounts[1],
      sig.v,
      sig.r,
      sig.s
    );
    updateGas('create', parseInt(gas));
    let tx = await newfangDID.createSigned(IDs[0], doc, size, fph, nonce, accounts[1], sig.v, sig.r, sig.s);
    await tx.wait();
    assert.equal((await newfangDID.docs(IDs[0])).size, size);
  });

  it('Read', async () => {
    let nonce = new Date().getTime();
    let payload = ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'uint256'],
      [IDs[0], nonce]
    );
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);

    let gas = await newfangDID.estimate.readSigned(IDs[0], nonce, accounts[1], sig.v, sig.r, sig.s);
    updateGas('read', parseInt(gas));
    let tx = await newfangDID.readSigned(IDs[0], nonce, accounts[1], sig.v, sig.r, sig.s);
    await tx.wait();
  });
  it('Update', async () => {
    let doc = [ethers.utils.formatBytes32String('hash of document')];
    let nonce = new Date().getTime();
    let payload = ethers.utils.defaultAbiCoder.encode(
      ['bytes32[]', 'bytes32[]', 'uint256'],
      [[IDs[0]], doc, nonce]
    );
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let gas = await newfangDID.estimate.updateSigned([IDs[0]], doc, nonce, accounts[1], sig.v, sig.r, sig.s);
    updateGas('update', parseInt(gas));
    let tx = await newfangDID.updateSigned([IDs[0]], doc, nonce, accounts[1], sig.v, sig.r, sig.s);
    await tx.wait();
    assert.equal((await newfangDID.docs(IDs[0])).doc, doc);
  });

  it('Delete', async () => {
    let nonce = new Date().getTime();
    let payload = ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'uint256'],
      [IDs[0], nonce]
    );
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);

    let gas = await newfangDID.estimate.deleteSigned(IDs[0], nonce, accounts[1], sig.v, sig.r, sig.s);
    updateGas('delete', parseInt(gas));
    let tx = await newfangDID.deleteSigned(IDs[0], nonce, accounts[1], sig.v, sig.r, sig.s);
    await tx.wait();
    assert.equal(
      (await newfangDID.docs(IDs[0])).doc,
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    );
  });
});
