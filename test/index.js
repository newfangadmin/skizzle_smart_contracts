const assert = require('assert');
const ethers = require('ethers');
const config = require('../config.json');

const ganache = require('ganache-cli');
const provider = new ethers.providers.Web3Provider(ganache.provider({gasLimit: 7000000}));

const newfangJson = require('../build/NewfangDIDRegistry.json');

let wallet, newfangDID, accounts, wallet1 = new ethers.Wallet(config.private_key);
let IDs = [
  "0x4de0e96b0a8886e42a2c35b57df8a9d58a93b5bff655bc37a30e2ab8e29dc066",
  "0x3d725c5ee53025f027da36bea8d3af3b6a3e9d2d1542d47c162631de48e66c1c",
  "0x967f2a2c7f3d22f9278175c1e6aa39cf9171db91dceacd5ee0f37c2e507b5abe"
];


let AccessTypes = {
  read: ethers.utils.formatBytes32String("read"),
  reshare: ethers.utils.formatBytes32String("reshare"),
  delete: ethers.utils.formatBytes32String("delete")
};

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
    assert.ok(newfangDID.address, 'Newfang DID  Register deployed');
  });

  it('Create an DID', async () => {
    let tx = await newfangDID.functions.createDID(IDs[0]);
    await tx.wait();
    assert.ok(await newfangDID.functions.owners(IDs[0]) === (await wallet.getAddress()),
      "Owner should be the person who calls the function");
  });

  it('Create an DID with same ID', async () => {
    try {
      let tx = await newfangDID.functions.createDID(IDs[0]);
      await tx.wait();
      assert(false, 'Should get an error');
    } catch (e) {
      assert.ok(e.message.includes('revert'), e.message)
    }
  });

});


describe('Contract functions', async () => {
  it('Share a file', async () => {
    let tx, ACK, ids = [], users = [], accessTypes = [], validity = [];

    for (let i = 2; i < 8; i++) {
      users.push((accounts[i]));
      accessTypes.push(AccessTypes["read"]);
      validity.push(120);
    }

    tx = await newfangDID.functions.share([IDs[0]], users, accessTypes, validity);
    await tx.wait();

    // Verify the changes
    for (let i = 2; i < 8; i++) {

      ACK = (await newfangDID.functions.accessSpecifier(IDs[0], AccessTypes["read"], (accounts[i])));
      assert.ok(parseInt(ACK._type) !== 0,
        "Type hash not set");
      assert.ok(parseInt(ACK.validity) !== 0, "Validity can not be 0")
    }


    // tx = await newfangDID.updateACK(IDs[0], accounts[6], AccessTypes.read,
    //   ethers.utils.hashMessage("asdf"), 0);
    // await tx.wait();
    // tx = await newfangDID.functions.share(IDs[0], accounts[6], AccessTypes["read"],
    //   ethers.utils.hashMessage("asdf"), 120);
    // await tx.wait();
    let tx2 = await newfangDID.functions.getAllUsers(IDs[0], AccessTypes.read);
    let array = tx2.filter(function (e) {
      return e === (accounts[6]);
    });
    assert.ok(array.length === 1, `Expected 1 but got ${array.length}`);
  });

  it('share file with zero validity period', async () => {
    try {
      let tx = await newfangDID.functions.share([IDs[0]], [(accounts[2])], [AccessTypes["read"]], [0]);
      await tx.wait();
      assert(false, 'Should get an error');
    } catch (e) {
      assert.ok(e.message.includes('revert'), e.message)
    }
  });


  it('share file with without owning the file', async () => {
    try {
      let tx = await newfangDID.connect(provider.getSigner(accounts[1])).functions.share([IDs[0]], [(accounts[3])], [AccessTypes["read"]], [120]);
      await tx.wait();
      assert(false, 'Should get an error');
    } catch (e) {
      assert.ok(e.message.includes('revert'), e.message)
    }
  });

  it('Get Key hash', async () => {
    let tx = await newfangDID.connect(provider.getSigner(accounts[2])).functions.getKeyHash(IDs[0], AccessTypes["read"]);
    let data = await tx.wait();
    let validity = await newfangDID.functions.accessSpecifier(IDs[0], AccessTypes["read"], (accounts[2]));
    assert.ok(parseInt(data.events[0].args[1]) === parseInt(validity), "Wrong data");
  });

  // it('Update file access', async () => {
  //   let tx = await newfangDID.functions.share([IDs[0]], [1], [(accounts[1])], [AccessTypes["read"]], [0]);
  //   await tx.wait();
  //   let ACK = (await newfangDID.functions.accessSpecifier(IDs[0], AccessTypes["read"], accounts[1]));
  //   assert.ok(ACK.encrypted_key === ethers.utils.hashMessage("asdfasdf"),
  //     "encrypted key's hash not updated");
  // });
  //
  // it('Share same file to same user', async () => {
  //   try {
  //     let tx = await newfangDID.functions.share(IDs[0], accounts[1], AccessTypes["read"],
  //       ethers.utils.hashMessage("asdfasdf"), 120);
  //     await tx.wait();
  //   } catch (e) {
  //     assert.ok(e.message.includes('revert'), e.message)
  //   }
  // });
  //
  it('Change File Owner', async () => {
    let tx = await newfangDID.functions.changeFileOwner(IDs[0], (accounts[1]));
    await tx.wait();
    assert.ok(await newfangDID.owners(IDs[0]) === (accounts[1]), "owner do not match");
  });
  //
  it('Get all users who has file access', async () => {
    let tx1 = await newfangDID.functions.getAllUsers(IDs[0], AccessTypes.read);
    let tx = await newfangDID.connect(provider.getSigner(accounts[1])).updateACK(IDs[0], (accounts[3]), AccessTypes.read, 0);
    await tx.wait();
    let tx2 = await newfangDID.functions.getAllUsers(IDs[0], AccessTypes.read);
    // console.log(tx2);
    tx1 = tx1.filter(function (element) {
      return element !== '0x0000000000000000000000000000000000000000';
    });
    tx2 = tx2.filter(function (element) {
      return element !== '0x0000000000000000000000000000000000000000';
    });
    let diff = tx1.length - tx2.length;
    // console.log(tx2,tx1, (accounts[3]));
    assert.ok(diff === 1, `Expected 1 but got ${diff}`);
  });

  it('Set File attributes', async () => {
    let n = 6;
    let k = 3;
    let file_size = 12;
    let ueb = '<UEB hash>';
    let tx = await newfangDID.connect(provider.getSigner(accounts[1])).functions.fileUpdate(IDs[0], n, k, file_size, ueb);
    await tx.wait();
    let file = (await newfangDID.functions.files(IDs[0]));
    assert.ok(parseInt(file.n) === n && parseInt(file.k) === k && parseInt(file.file_size) === file_size && file.ueb === ueb, "File attributes don't match");
  });

  it('Remove DID', async () => {
    let did_tx = await newfangDID.createDID(IDs[1]);
    await did_tx.wait();

    let share_tx1 = await newfangDID.functions.share([IDs[1]], [(accounts[2])], [AccessTypes.read], [1200]);
    await share_tx1.wait();


    assert.ok(parseInt(await newfangDID.getTotalUsers(IDs[1], AccessTypes.read)) === 1, 'Invalid total read users');

    let tx = await newfangDID.removeDID(IDs[1]);
    await tx.wait();

    assert.ok(parseInt(await newfangDID.getTotalUsers(IDs[1], AccessTypes.read)) === 0, 'Total users must be 0');
    assert.ok(parseInt((await newfangDID.files(IDs[1])).k) === 0, "File still exist on blockchain");
    assert.ok(await newfangDID.owners(IDs[1]) === "0x0000000000000000000000000000000000000000", "owner still exist");

  });


});

describe('Signed Functions', async () => {
  it('Get Key hash Signed', async () => {
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32", "uint256"], [IDs[0], AccessTypes.read, await newfangDID.functions.nonce((accounts[1]))]);
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let tx = await newfangDID.functions.getKeyHashSigned(IDs[0], AccessTypes.read, (accounts[1]), sig.v, sig.r, sig.s);
    let data = await tx.wait();
    let validity = (await newfangDID.functions.accessSpecifier(IDs[0], AccessTypes["read"], (accounts[1])));
    assert.ok(parseInt(data.events[0].args[1]) === parseInt(validity), "Wrong data");
  });

  it('Change Owner Signed', async () => {
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "uint256"], [IDs[0], accounts[9], await newfangDID.functions.nonce((accounts[1]))]);
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let tx = await newfangDID.functions.changeOwnerSigned(IDs[0], accounts[9], (accounts[1]), sig.v, sig.r, sig.s);
    await tx.wait();
    assert.ok(await newfangDID.owners(IDs[0]) === accounts[9], "owner do not match");
  });

  it('Create DID Signed', async () => {
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256"], [IDs[2], await newfangDID.functions.nonce((accounts[1]))]);
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let tx = await newfangDID.functions.createDIDSigned(IDs[2], (accounts[1]), sig.v, sig.r, sig.s);
    await tx.wait();
    assert.ok(await newfangDID.owners(IDs[2]) === (accounts[1]), "owner do not match");
  });

  it('Share DID Signed', async () => {
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32[]", "address[]", "bytes32[]", "uint256[]", "uint256"],
      [
        [IDs[2]],
        [accounts[1]],
        [AccessTypes.read],
        [120],
        await newfangDID.functions.nonce((accounts[1]))
      ]);
    // console.log(await newfangDID.owners(IDs[2]) === (accounts[1]));
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let tx = await newfangDID.functions.shareSigned(
      [IDs[2]],
      [(accounts[1])],
      [AccessTypes.read],
      [120],
      (accounts[1]), sig.v, sig.r, sig.s);
    await tx.wait();
    let ACK = await newfangDID.functions.accessSpecifier(IDs[2], AccessTypes["read"], (accounts[1]));
    assert.ok(parseInt(ACK.validity) !== 0, "Validity can not be 0")
  });

  it('Update ACK Signed with non zero validity', async () => {
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "bytes32", "uint256", "uint256"], [IDs[2], (accounts[1]), AccessTypes["read"], 10, await newfangDID.functions.nonce((accounts[1]))]);
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let tx = await newfangDID.functions.updateACKSigned(IDs[2], (accounts[1]), AccessTypes["read"], 10, (accounts[1]), sig.v, sig.r, sig.s);
    await tx.wait();
    let ACK = (await newfangDID.functions.accessSpecifier(IDs[2], AccessTypes["read"], (accounts[1])));
    assert.ok(parseInt(ACK.validity) !== 0, "Validity can not be 0")
  });

  it('Update ACK Signed with zero validity', async () => {
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "bytes32", "uint256", "uint256"], [IDs[2], (accounts[1]), AccessTypes["read"], 0, await newfangDID.functions.nonce((accounts[1]))]);
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let tx = await newfangDID.functions.updateACKSigned(IDs[2], (accounts[1]), AccessTypes["read"], 0, (accounts[1]), sig.v, sig.r, sig.s);
    await tx.wait();
    let validity = (await newfangDID.functions.accessSpecifier(IDs[2], AccessTypes["read"], (accounts[1])));
    assert.ok(parseInt(validity) === 0, "Validity can not be 0")
  });


  it('Set File attributes Signed', async () => {
    let n = 16;
    let k = 13;
    let file_size = 22;
    let ueb = '<UEB hash>';

    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256", "uint256", "uint256", "string", "uint256"], [IDs[2], n, k, file_size, ueb, await newfangDID.functions.nonce((accounts[1]))]);
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await provider.getSigner(accounts[1]).signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    let tx = await newfangDID.functions.fileUpdateSigned(IDs[2], n, k, file_size, ueb, (accounts[1]), sig.v, sig.r, sig.s);
    await tx.wait();

    let file = (await newfangDID.functions.files(IDs[2]));
    assert.ok(parseInt(file.n) === n && parseInt(file.k) === k && parseInt(file.file_size) === file_size && file.ueb === ueb, "File attributes don't match");
  });

});
