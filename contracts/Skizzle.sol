pragma solidity ^0.5;

import './SafeMath.sol';
import './Initializable.sol';

contract Skizzle is Initializable {
    address public owner;
    using SafeMath for uint;

    // keccak256(storage index) => bytes32 newfang-specific-idbytes
    mapping(bytes32 => address) public owners; // file owners
    mapping(address => uint) public nonce;
    mapping(bytes32 => File) public docs;
    mapping(address => bool) public isNode;

    struct File {
        bytes32 ueb;
        bytes32 doc;
    }

    modifier onlyFileOwner(bytes32 _file, address _identity) {
        require(_identity == owners[_file]);
        _;
    }

    modifier onlyOwner(){
        require(msg.sender == owner);
        _;
    }

    modifier onlyNode(){
        require(isNode[msg.sender], "Should be called by owner");
        _;
    }


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

    function getSigner(bytes32 payloadHash, address signer, uint8 v, bytes32 r, bytes32 s) public pure returns (address){
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
        address actualSigner = ecrecover(messageHash, v, r, s);
        require(signer == actualSigner);
        return actualSigner;
    }

    event NewCreate(
        address identity,
        bytes32 file,
        bytes32 doc
    );

    function createSigned(bytes32 _file, bytes32 _doc, bytes32 _ueb, address signer, uint8 v, bytes32 r, bytes32 s) public {
        require(owners[_file] == address(0), "Owner already exist for this file");
        bytes32 payloadHash = keccak256(abi.encode(_file, _doc, nonce[signer]));
        address identity = getSigner(payloadHash, signer, v, r, s);
        owners[_file] = identity;
        docs[_file] = File(_ueb, _doc);
        emit NewCreate(identity, _file, _doc);
        nonce[signer]++;
    }

    function updateSigned(bytes32 _file, bytes32 _doc, address signer, uint8 v, bytes32 r, bytes32 s) public {
        bytes32 payloadHash = keccak256(abi.encode(_file, _doc, nonce[signer]));
        address identity = getSigner(payloadHash, signer, v, r, s);
        require(owners[_file] == identity, "Can only called by file owner");
        docs[_file].doc = _doc;
        emit NewCreate(identity, _file, _doc);
        nonce[signer]++;
    }
}
