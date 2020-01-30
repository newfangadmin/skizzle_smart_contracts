var EC = require('elliptic').ec;
var config = require('./config.json');
const ethers = require('ethers');
// Create and initialize EC context
// (better do it once and reuse it)
var ec = new EC('secp256k1');

var sha3 = require("js-sha3").keccak_256;

let wallet = new ethers.Wallet(config.private_key);

(async ()=>{
  let data = [
    "0x19",
    "0x00",
    "addDelegate",
  ];
  let signature = (ec.sign(sha3(data), wallet.privateKey, "hex", {canonical: true}));
  let r = "0x"+ signature.r.toString("hex");
  let s = "0x"+ signature.s.toString("hex");
  let v = signature.recoveryParam;
  console.log(r, s, v);
})();
