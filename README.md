# Newfang DID Method Specification
[![Build Status](https://travis-ci.com/newfangadmin/skizzle_smart_contracts.svg?token=2yjAythLGDwdY1XXtyDa&branch=dev)](https://travis-ci.com/newfangadmin/skizzle_smart_contracts)

# Abstract
Newfang is a decentralized cloud storage platform with a modular decentralized access control layer that can plug into any underlying storage. The intention at Newfang is to give users back real ownership and control of their files. We hope to do this by giving every file, uploaded to Newfang, a unique, globally resolvable and decentralized id.
Possession of a Newfang DID guarantees open access to some or all of the non-private meta information about the file such as its owner's public key, size... but is not a guarantee of being able to download it. If the associated DDOC contains the public key and the recipient can authenticate themselves using their private key, they will then be able to download the file.

This is a provisional version of the Newfang DID Method spec with an implementation on the [Matic Network](matic.network), a L2 scaling solution on top of [Ethereum](ethereum.org). Current versions allow owners to be Ethereum account holders and share files with other Ethereum account holders who authenticate themselves by signing transactions having them verified on our smart contract. Future versions will afford for various authentication mechanisms.

# DID Method Name
The name-string that shall identify this DID method is:  `newfang`.

A DID that uses this method  **MUST**  begin with the following prefix:  `did:newfang`.

# DID Method Specific Identifier
The method specific identifier is represented as the Hex-encoded Ethereum address on the target network.

```
newfang-did = "did:newfang:" newfang-specific-idstring
newfang-specific-idstring = [ ethereum-network ":" ] newfang-storage-index
ethr-network = "mainnet" / "ropsten" / "rinkeby"
newfang-storage-index = 64*HEXDIG
```

The Ethereum address is case-insensitive.

Note, if no public Ethereum network was specified, it is assumed that the DID is anchored on the Ethereum mainnet per default. This means the following DIDs will resolve to the same DID Document:

```
did:newfang:ropsten:9aca7002881c067710c53fbb623a25f2fa044d95425a422fd2c59bca3465ba80
did:newfang:9aca7002881c067710c53fbb623a25f2fa044d95425a422fd2c59bca3465ba80
```

# DID Document
Example DDOC:
```
{
	'@context': 'https://w3id.org/did/v1',
	id:'did:newfang:9aca7002881c067710c53fbb623a25f2fa044d95425a422fd2c59bca3465ba80',
	created: "2019-12-10T14:53:09",
	updated: "2019-12-12T08:23:19",
	publicKey: [{
		id: 'did:newfang:9aca7002881c067710c53fbb623a25f2fa044d95425a422fd2c59bca3465ba80#owner',
		type: 'ethereumAddress',
		controller: '0xb9c5714089478a327f09197987f16f9e5d936e8a'
	}, {
		id: 'did:newfang:9aca7002881c067710c53fbb623a25f2fa044d95425a422fd2c59bca3465ba80#delegate1',
		type: 'ethereumAddress',
		controller: '0x6C75A501c0cE65f3AdB44fd14e07df324cCA2e86'
	}],
	authentication: [{
		type: 'Secp256k1SignatureAuthentication2018',
		publicKey: '0xb9c5714089478a327f09197987f16f9e5d936e8a'
	}, {
		type: 'Secp256k1SignatureAuthentication2018',
		publicKey: '0x6C75A501c0cE65f3AdB44fd14e07df324cCA2e86'
	}],
	service: [{
		id: 'did:newfang:9aca7002881c067710c53fbb623a25f2fa044d95425a422fd2c59bca3465ba80#getFileMeta'
		index: 0,
		type: 'getFileMeta',
		serviceEndpoint: //endpoint to fetch file metadata
	}, {
		id: 'did:newfang:9aca7002881c067710c53fbb623a25f2fa044d95425a422fd2c59bca3465ba80#getFile'
		index: 1,
		type: 'getFile',
		serviceEndpoint: //endpoint to download the file
	}],
	
	//Newfang specific attributes
	size: 12352141,
	k: 4,
	n: 6,
	uhash: '6rudoctmbxsmbg7gwtjlimd6umtwrrsxkjzthuldsmo4nnfoc6fa'
}
```

# DID CRUD Operations
The Newfang DID CRUD relies on the [Newfang DID Resolver](https://github.com/newfangadmin/newfang_did_resolver) package.
### Create

 1. The Newfang client SDK generates a high entropy symmetric encryption/decryption key which is SHA256 hashed to produce the **Storage Index** which is the Newfang specific identifier in the DID.
 2. The file is encrypted with the key generated and uploaded to the network of Newfang storage nodes with a specific storage node handling the request.
 3. Storage Index, file size and some other config data is signed on the client with the user's private key. This is passed as a signed Tx to the same storage node which submits the transaction to the Ethereum blockchain and stores the data in data structures in the Newfang DID Registry smart contract.
 ```
 // keccak256(storage index) => owner address
mapping(bytes32 => address) public owners;

mapping(address => uint) public nonce;

/**
* @dev This function will be used by createDID pubic function and createDIDSigned
* @return bool
*/
function createDID(bytes32 _id, address _identity) internal returns (bool){
	require(owners[_id] == address(0), "Owner already exist for this file");
	owners[_id] = _identity;
	nonce[_identity]++;
	return true;
}
```

### Read
A method in the Newfang DID Resolver takes the DID(string) as input and is able to build the DDOC JSON by referencing the relevant data structures in the Newfang DID Registry smart contract.
```
const Resolver = require('newfang-did-resolver');
let resolver = new Resolver();

(async() => {
    console.log(await resolver.resolve('did:newfang:<newfang DID>'))
})();

/*
OUTPUT: <newfang DDOC JSON>
*/
```

### Update
Update operations are performed to:

 1. Change the file owner public key. To either transfer ownership or rotate keys.
 2. Add a new public key. To signify the entity(person, application, org or device) with whom the file is shared.
 3. Remove a public key. To revoke previously endowed access.

### Delete
This is done to signify deletion of the file and involves complete removal of the associated entry in the Newfang DID Registry smart contract. This results in anyone holding a DID being unable to resolve it.
We choose to do this in adherence to [privacy by design](https://en.wikipedia.org/wiki/Privacy_by_design) principles and affording a user's data to be forgotten.


# Security Considerations
The following points should be considered and are open to discussion by the community with regard to general security:

-   DID CRUD is performed by the Newfang DID Resolver package and hence only a trusted(checksummed) version of it should be used.
- Updating DID owner/controller and adding of a public key of file recipient involve manual entry by the current owner and assumes due caution.
- No key recovery mechanism is currently proposed but will however be done in future versions.

# Implementation
Coming Soon!

# Open Items
1.  File metadata is also very important(name, type, size...) to give users more info, show previews/thumbnails etc... Where is this info and how can this be accessed?
2.  Can we allow users to discover and request for files?
3.  Can we extend this to mutable files? i.e. a file uploaded to Newfang and carrying a specific DID where the file can be updated(contents) without needing to update the DID.

# References
- [did:ethr](https://github.com/decentralized-identity/ethr-did-resolver/blob/develop/doc/did-method-spec.md)
- [did:selfkey](https://github.com/SelfKeyFoundation/selfkey-did-ledger/blob/develop/DIDMethodSpecs.md)
- [did-core](https://w3c.github.io/did-core/)
- [Newfang DID Resolver](https://github.com/newfangadmin/newfang_did_resolver)
- [Privacy by Design](https://en.wikipedia.org/wiki/Privacy_by_design)


## Deploying proxy smart contract
```shell script
zos init # crates zos.json
zos add Skizzle
zos push --network private
zos create Skizzle --network private
```
## Node List
```jsongit 
["0x85dC57e32ce816d733D184252140E5230292b236","0x058ed96E9e02fbe6a1b7b04d4dA1E529841187E1","0xA0013c6B1576cC482C03d108Cb51c03467cA86aC","0xf5d37b2681D0A867849A33b1c4C656086962b2F0","0x2BBF87A6B75D20DF4C5666b76c1d21f3563dB87a","0x9D719DE41003f2BAE4c5a04cb33B435a68Ee13af"]
```
