pragma solidity ^0.5;

import "./SafeMath.sol";
import "./Initializable.sol";

contract Skizzle is Initializable {
    address public owner;
    using SafeMath for uint256;

    // keccak256(storage index) => bytes32 newfang-specific-idbytes
    mapping(bytes32 => File) public docs;
    mapping(address => bool) public isNode;
    mapping(address => uint256) public nonce;

    struct File {
        address owner;
        bytes32 ueb;
        bytes32 doc;
        uint256 n;
        uint256 k;
        uint256 size;
    }

    // Modifier to check whether the functions are called by file owners.
    modifier onlyFileOwner(bytes32 _file, address _identity) {
        require(_identity == docs[_file].owner);
        _;
    }

    // Modifier to check whether then functions are called only by contract owners.
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    // Modifier to check whether functions are called by SNA nodes. 
    modifier onlyNode() {
        require(isNode[msg.sender], "Should be called by owner");
        _;
    }

    // Initialize is called when contract is deployed.
    // It does 2 things:
    // 1. Set's the contract owner 
    // 2. It adds default nodes to the contract. 
    function initialize(address[] memory _nodes) public initializer {
        owner = msg.sender;
        for (uint256 i = 0; i < _nodes.length; i++) {
            isNode[_nodes[i]] = true;
        }
    }

    function addNode(address _node) public onlyOwner {
        isNode[_node] = true;
    }

    function deleteNode(address _node) public onlyOwner {
        isNode[_node] = false;
    }

    function getSigner(
        bytes32 payloadHash,
        address signer,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public pure returns (address) {
        bytes32 messageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash)
        );
        address actualSigner = ecrecover(messageHash, v, r, s);
        require(signer == actualSigner);
        return actualSigner;
    }

    event create(address identity, bytes32 file, bytes32 doc, uint256 n, uint256 k, uint256 size);
    event read(address identity, bytes32 file);
    event update(address identity, bytes32 file, bytes32 doc);
    event deleteDID(address identity, bytes32 file);

    function createSigned(
        bytes32 _file,
        bytes32 _doc,
        bytes32 _ueb,
        uint256 _n,
        uint256 _k,
        uint256 _size,
        address signer,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        require(
            docs[_file].owner == address(0),
            "Owner already exist for this file"
        );
        bytes32 payloadHash = keccak256(abi.encode(_file, _doc, _n, _k, _size,nonce[signer]));
        getSigner(payloadHash, signer, v, r, s); // Just to check signature is valid or not. 
        docs[_file] = File(signer,_ueb, _doc, _n, _k, _size);
        nonce[signer]++;
        emit create(signer, _file, _doc, _n, _k, _size);
    }

    // This function does not checks wether the signer has permission to read/download the file or not. 
    // Permission should be checked offline only.
    // User will sign a transaction and send it to SNA, SNA will verify wether user is having permission or not. 
    // If user has permission then this function will be called.
    // This functions verifies the email and emit a read event on the file. 
    function readSigned(
        bytes32 _file,
        address signer,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        bytes32 payloadHash = keccak256(abi.encode(_file, nonce[signer]));
        getSigner(payloadHash, signer, v, r, s); // Just to check signature is valid or not. 
        nonce[signer]++;
        emit read(signer, _file);
    }

    // This function is used for share and revoke. The DID Document is updated and the merkle root is calculated again and update here.  
    // onlyFileOwner modifier checks whether user has the permission to call the function or not. 
    // It does not checks for signature. 
    // Signature is checked in getSigner function. 
    function updateSigned(
        bytes32 _file,
        bytes32 _doc,
        address signer,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) onlyFileOwner(_file, signer) public { 
        bytes32 payloadHash = keccak256(abi.encode(_file, _doc, nonce[signer]));
        getSigner(payloadHash, signer, v, r, s); // Just to check signature is valid or not. 
        docs[_file].doc = _doc;
        nonce[signer]++;
        emit update(signer, _file, _doc);
    }

    function deleteSigned(
        bytes32 _file,
        address signer,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) onlyFileOwner(_file, signer) public {
        bytes32 payloadHash = keccak256(abi.encode(_file, nonce[signer]));
        getSigner(payloadHash, signer, v, r, s); // Just to check signature is valid or not. 
        delete docs[_file];
        nonce[signer]++;
        emit deleteDID(signer, _file);
    }
}
