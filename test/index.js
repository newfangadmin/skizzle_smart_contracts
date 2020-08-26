const assert = require('assert');
const ethers = require('ethers');
const config = require('../config.json');

const ganache = require('ganache-cli');
const fs = require('fs');

const provider = new ethers.providers.Web3Provider(ganache.provider({gasLimit: 8000000}));

const newfangJson = require('../build/contracts/Skizzle.json');

let wallet, newfangDID, accounts, wallet1 = new ethers.Wallet(config.private_key);

let gasFees = {};
let IDs = [
  "0x4de0e96b0a8886e42a2c35b57df8a9d58a93b5bff655bc37a30e2ab8e29dc066",
  "0x3d725c5ee53025f027da36bea8d3af3b6a3e9d2d1542d47c162631de48e66c1c",
  "0x967f2a2c7f3d22f9278175c1e6aa39cf9171db91dceacd5ee0f37c2e507b5abe",
  "0x6e65772069640000000000000000000000000000000000000000000000000000"
];


let AccessTypes = {
  read: ethers.utils.formatBytes32String("read"),
  reshare: ethers.utils.formatBytes32String("reshare"),
  delete: ethers.utils.formatBytes32String("delete")
};

function updateGas(key, value) {
  gasFees[key] = value;
  fs.writeFileSync('gas.json', JSON.stringify(gasFees));
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
    const newfangContract = new ethers.ContractFactory(
      newfangJson.abi,
      newfangJson.bytecode,
      wallet
    );
    newfangDID = await newfangContract.deploy();
    await newfangDID.deployed();

    let nodes = [
      "0x85dC57e32ce816d733D184252140E5230292b236",
      "0x058ed96E9e02fbe6a1b7b04d4dA1E529841187E1",
      "0xA0013c6B1576cC482C03d108Cb51c03467cA86aC",
      "0xf5d37b2681D0A867849A33b1c4C656086962b2F0",
      "0x2BBF87A6B75D20DF4C5666b76c1d21f3563dB87a",
      "0x9D719DE41003f2BAE4c5a04cb33B435a68Ee13af"
    ];

    let tx = await newfangDID.functions.initialize(nodes);
    await tx.wait();
    assert.ok(newfangDID.address, 'Newfang DID  Register deployed');
  });

  it('Add nodes', async () => {

    let total_nodes = 6;
    for (let i = 0; i < total_nodes; i++) {
      let tx = await newfangDID.addNode(accounts[i]);
      await tx.wait()
    }

    assert.ok(parseInt(await newfangDID.total_nodes()) === total_nodes + 6, "Node length doesn't match");
  })

});


describe('Signed Functions', async () => {
  it('Create DID Signed', async () => {
    let n = 6, k = 4, file_size = 1200, ueb = "UEB";
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256"], [IDs[2], n, k, file_size, await newfangDID.functions.nonce((accounts[1]))]);
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let gas = await newfangDID.estimate.createDIDSigned(IDs[2], n, k, file_size, (accounts[1]), sig.v, sig.r, sig.s, ethers.utils.toUtf8Bytes(ueb));
    updateGas("create did", parseInt(gas));
    let tx = await newfangDID.functions.createDIDSigned(IDs[2], n, k, file_size, (accounts[1]), sig.v, sig.r, sig.s, ethers.utils.toUtf8Bytes(ueb));
    await tx.wait();
    assert.ok(await newfangDID.owners(IDs[2]) === (accounts[1]), "owner do not match");
    let file = await newfangDID.files(IDs[2]);
    assert.ok(!(await newfangDID.isDeleted(IDs[2])), "File status is deleted");
    assert.ok(ethers.utils.toUtf8String(file.ueb) === ueb, "UEB doesn't match");
  });


  it('Share DID Signed', async () => {
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32[]", "address[]", "bytes32[]", "uint256[]", "uint256"],
      [
        [IDs[2]],
        [accounts[2]],
        [AccessTypes.read],
        [120],
        await newfangDID.functions.nonce((accounts[1]))
      ]);
    // console.log(await newfangDID.owners(IDs[2]) === (accounts[2]));
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let gas = await newfangDID.estimate.shareSigned(
      [IDs[2]],
      [(accounts[2])],
      [AccessTypes.read],
      [120],
      accounts[1], sig.v, sig.r, sig.s);
    updateGas("share", parseInt(gas));
    let tx = await newfangDID.functions.shareSigned(
      [IDs[2]],
      [(accounts[2])],
      [AccessTypes.read],
      [120],
      accounts[1], sig.v, sig.r, sig.s);
    await tx.wait();
    let ACK = await newfangDID.functions.accessSpecifier(IDs[2], AccessTypes["read"], (accounts[2]));
    assert.ok(parseInt(ACK.validity) !== 0, "Validity can not be 0")
  });

  it('Download Signed', async () => {
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32", "uint256"], [IDs[2], AccessTypes.read, await newfangDID.functions.nonce((accounts[2]))]);
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[2]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    updateGas("download", parseInt(await newfangDID.estimate.downloadSigned(IDs[2], AccessTypes.read, (accounts[2]), sig.v, sig.r, sig.s)));
    let tx = await newfangDID.functions.downloadSigned(IDs[2], AccessTypes.read, (accounts[2]), sig.v, sig.r, sig.s);
    let data = await tx.wait();
    // console.log(data.events[0]);
    let validity = (await newfangDID.functions.accessSpecifier(IDs[2], AccessTypes["read"], (accounts[2])));
    assert.ok(parseInt(data.events[0].args.validity) === parseInt(validity), "Wrong data");
  });

  // it('Change Owner Signed', async () => {
  //   let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "uint256"], [IDs[0], accounts[9], await newfangDID.functions.nonce((accounts[1]))]);
  //   let payloadHash = ethers.utils.keccak256(payload);
  //   let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
  //   let sig = ethers.utils.splitSignature(signature);
  //   await newfangDID.functions.changeOwnerSigned(IDs[0], accounts[9], (accounts[1]), sig.v, sig.r, sig.s);
  //   assert.ok(await newfangDID.owners(IDs[0]) === accounts[9], "owner do not match");
  // });

  it('Revoke Signed with zero validity', async () => {
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "bytes32", "uint256"], [IDs[2], (accounts[2]), AccessTypes["read"], await newfangDID.functions.nonce((accounts[1]))]);
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let gas = await newfangDID.estimate.revokeSigned(IDs[2], (accounts[2]), AccessTypes["read"], (accounts[1]), sig.v, sig.r, sig.s);
    updateGas("revoke", parseInt(gas));
    let tx = await newfangDID.functions.revokeSigned(IDs[2], (accounts[2]), AccessTypes["read"], (accounts[1]), sig.v, sig.r, sig.s);
    await tx.wait();
    let validity = (await newfangDID.functions.accessSpecifier(IDs[2], AccessTypes["read"], (accounts[2])));
    assert.ok(parseInt(validity) === 0, "Validity not 0")
  });

  it('Remove DID Signed ', async () => {
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256"], [IDs[2], await newfangDID.functions.nonce((accounts[1]))]);
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let gas = await newfangDID.estimate.deleteFileSigned(IDs[2], accounts[1], sig.v, sig.r, sig.s);
    updateGas("delete", parseInt(gas));
    let before = await newfangDID.version(IDs[2]);
    let tx = await newfangDID.functions.deleteFileSigned(IDs[2], accounts[1], sig.v, sig.r, sig.s);
    await tx.wait();
    let after = await newfangDID.version(IDs[2]);
    assert.ok(after - before === 1, "Version not decreased");
    assert.ok(await newfangDID.owners(IDs[2]) === "0x0000000000000000000000000000000000000000", "Owner not removed");
    assert.ok(await newfangDID.isDeleted(IDs[2]), "Deleted status not changed")
  });

});
