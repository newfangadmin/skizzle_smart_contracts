const assert = require('assert');
const ethers = require('ethers');
const config = require('./config.json');


const provider = new ethers.providers.JsonRpcProvider("https://rpc-mumbai.matic.today");

const newfangJson = require('./build/contracts/Skizzle.json');

let wallet, newfangDID;


(async () => {
  wallet = await new ethers.Wallet(config.private_key, provider);
  let nonce_transaction = (await wallet.getTransactionCount("pending"));
  newfangDID = await new ethers.Contract("0x527778e73eC371979F85826C50EF8758d60366F0", newfangJson.abi, wallet);
  console.log('Connected to address: ', newfangDID.address);
  let n = 6, k = 4, file_size = 1200, ueb;
  let address = await wallet.getAddress();
  let nonce = parseInt(await newfangDID.functions.nonce((address)));
  console.log("Current user nonce: ", nonce);
  console.log("Wallet nonce: ", nonce_transaction);
  let start = new Date().getTime();
  for (let i = 0; i < 5; i++) {
    ueb = `UEB-${new Date().getTime()}-${i + 1}`;
    let ids = await ethers.utils.formatBytes32String(`ID-${new Date().getTime()}-${i}`);
    let payload = ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256"], [ids, n, k, file_size, nonce]);
    let payloadHash = ethers.utils.keccak256(payload);
    let signature = await wallet.signMessage(ethers.utils.arrayify(payloadHash));
    let sig = ethers.utils.splitSignature(signature);
    newfangDID.functions.createDIDSigned(ids, n, k, file_size, (address), sig.v, sig.r, sig.s, ethers.utils.toUtf8Bytes(ueb), {nonce: nonce_transaction}).then((tx) => {
      console.log(`submitted tx ${i + 1}`);
      tx.wait().then((d) => {
        console.log(`Tx ${i + 1} mined. Block: ${d.blockNumber}. Time elapsed: ${(new Date().getTime() - start) / 1000}`);
      });
    });
    console.log(`Processed tx ${i + 1}`);
    nonce++;
    nonce_transaction++;
  }
})();
