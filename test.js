const assert = require('assert');
const ethers = require('ethers');
const config = require('./config.test.json');

const provider = new ethers.providers.JsonRpcProvider('https://rpc-mumbai.matic.today');

const newfangJson = require('./build/contracts/Skizzle.json');

let wallet, newfangDID;

(async () => {
	wallet = await new ethers.Wallet(config.private_key, provider);

	// const newfangContract = new ethers.ContractFactory(
	//   newfangJson.abi,
	//   newfangJson.bytecode,
	//   wallet
	// );
	// newfangDID = await newfangContract.deploy();
	// await newfangDID.deployed();

	// let nodes = [
	//   "0x85dC57e32ce816d733D184252140E5230292b236",
	//   "0x058ed96E9e02fbe6a1b7b04d4dA1E529841187E1",
	//   "0xA0013c6B1576cC482C03d108Cb51c03467cA86aC",
	//   "0xf5d37b2681D0A867849A33b1c4C656086962b2F0",
	//   "0x2BBF87A6B75D20DF4C5666b76c1d21f3563dB87a",
	//   "0x9D719DE41003f2BAE4c5a04cb33B435a68Ee13af",
	//   "0xC8e1F3B9a0CdFceF9fFd2343B943989A22517b26"
	// ];

	// let tx = await newfangDID.functions.initialize(nodes);
	// await tx.wait();

	// console.log(await newfangDID.address);

	let nonce_transaction = await wallet.getTransactionCount('pending');
	newfangDID = await new ethers.Contract('0xB8E1dc2733683B159A17121649aAf84dbe70A314', newfangJson.abi, wallet);
	console.log('Connected to address: ', newfangDID.address);
	let n = 6,
		k = 4,
		file_size = 1200,
		ueb;
	let address = await wallet.getAddress();
	console.log('Wallet nonce: ', nonce_transaction);
	let start = new Date().getTime();
	for (let i = 0; i < 150; i++) {
		let nonce = new Date().getTime();
		ueb = `UEB-${new Date().getTime()}-${i + 1}`;
		let ids = await ethers.utils.formatBytes32String(`ID-${new Date().getTime()}-${i}`);
		let payload = ethers.utils.defaultAbiCoder.encode(
			[ 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256' ],
			[ ids, n, k, file_size, nonce ]
		);
		let payloadHash = ethers.utils.keccak256(payload);
		wallet.signMessage(ethers.utils.arrayify(payloadHash)).then((signature) => {
			let sig = ethers.utils.splitSignature(signature);
			newfangDID.functions
				.createDIDSigned(
					ids,
					n,
					k,
					file_size,
					address,
					nonce,
					sig.v,
					sig.r,
					sig.s,
					ethers.utils.toUtf8Bytes(ueb),
					{
						nonce: nonce_transaction
					}
				)
				.then((tx) => {
					console.log(`submitted tx ${i + 1}`);
					tx.wait().then((d) => {
						console.log(
							`Tx ${i + 1} mined. Block: ${d.blockNumber}. Time elapsed: ${(new Date().getTime() -
								start) /
								1000}`
						);
					});
				});
		});
		nonce_transaction++;
	}
})();
