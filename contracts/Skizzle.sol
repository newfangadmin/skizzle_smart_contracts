pragma solidity ^0.5;

import './SafeMath.sol';
import './Initializable.sol';

contract Skizzle is Initializable {
    address public owner;
    using SafeMath for uint;
    bytes32 public log;

    // keccak256(storage index) => bytes32 newfang-specific-idbytes
    mapping(bytes32 => address) public owners; // file owners
    // file id => access type => user => ACK
    mapping(bytes32 => mapping(bytes32 => mapping(address => ACK))) public accessSpecifier;
    // It is used to get all users of a particular type with particular access
    mapping(bytes32 => mapping(bytes32 => address[])) public userAccess;
    mapping(address => mapping(uint256 => bool)) public nonce;
    mapping(bytes32 => File) public files;
    mapping(bytes32 => bool) public isDeleted;
    mapping(bytes32 => uint256) public version;
    mapping(address => bool) public isNode;
    mapping(address => Usage[]) usages;
    uint256 public total_nodes;

    struct ACK {
        uint256 validity;
        uint256 version;
    }

    // similar to sets
    struct Access {
        bytes32[] types;
        mapping(bytes32 => bool) is_in;
    }

    struct File {
        uint256 n;
        uint256 k;
        uint256 file_size;
        address handling_node;
        bytes ueb;
    }

    struct Usage {
        uint256 total_bytes;
        bytes32 usage_type; // 0 => upload; 1 => download
        bytes32 file;
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
            total_nodes++;
            isNode[_nodes[i]] = true;
        }
    }

    function addNode(address _node) public onlyOwner {
        total_nodes++;
        isNode[_node] = true;
    }

    function deleteNode(address _node) public onlyOwner {
        total_nodes--;
        isNode[_node] = false;
    }

    function getSigner(bytes32 payloadHash, address signer, uint8 v, bytes32 r, bytes32 s) public pure returns (address){
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
        address actualSigner = ecrecover(messageHash, v, r, s);
        require(signer == actualSigner);
        return actualSigner;
    }


    function createDIDSigned(bytes32 _file, uint256 n, uint256 k, uint256 _file_size, address signer, uint256 _nonce, uint8 v, bytes32 r, bytes32 s, bytes memory _ueb) public onlyNode {
        require(!nonce[signer][_nonce], "None already used");
        require(owners[_file] == address(0), "Owner already exist for this file");
        require(n <= total_nodes, "N should be less then number of total nodes");
        require(n > k, "n>k");
        require(k > 1, "k should not be 0");
        require(_file_size != 0, "Should not be 0");
        bytes32 payloadHash = keccak256(abi.encode(_file, n, k, _file_size, _nonce));
        address _identity = getSigner(payloadHash, signer, v, r, s);
        owners[_file] = _identity;
        files[_file] = File(n, k, _file_size, msg.sender, _ueb);
        isDeleted[_file] = false;
        emit NewFileUpdate(owners[_file], _file, n, k, _file_size, _ueb);
        nonce[signer][_nonce] = true;
    }

    event deleteFileEvent(
        address indexed identity,
        bytes32 indexed file
    );


    function deleteFileSigned(bytes32 _file, address signer, uint256 _nonce, uint8 v, bytes32 r, bytes32 s) public onlyNode {
        require(!nonce[signer][_nonce], "None already used");
        bytes32 payloadHash = keccak256(abi.encode(_file, _nonce));
        address _identity = getSigner(payloadHash, signer, v, r, s);
        require(owners[_file] == _identity, "Owner does not match");
        isDeleted[_file] = true;
        version[_file]++;
        delete owners[_file];
        nonce[signer][_nonce] = true;
        emit deleteFileEvent(_identity, _file);
    }


    function getAllUsers(bytes32 _file, bytes32 _access_type) public view returns (address[] memory){
        address[] memory users = userAccess[_file][_access_type];
        address user;
        for (uint i = 0; i < users.length; i++) {
            user = userAccess[_file][_access_type][i];
            uint256 current_version = version[_file];
            if (accessSpecifier[_file][_access_type][user].validity <= now || accessSpecifier[_file][_access_type][user].version != current_version) {
                delete users[i];
            }
        }
        return users;
    }


    event NewShare(
        address indexed identity,
        bytes32 indexed file,
        address indexed user,
        bytes32 access_type,
        uint256 validity,
        uint256 nonce
    );

    /**
    * @dev key is encrypted with users public key and stored on a server hash of encrypted key is stored here in smart
     contract along with its validity
    * @return bool
    */
    function shareSigned(bytes32[] memory _files, address _user, bytes32[] memory _access_type, uint256[] memory _validity, address signer, uint256 _nonce, uint8 v, bytes32 r, bytes32 s) onlyNode public {
        require(!nonce[signer][_nonce], "None already used");
        bytes32 payloadHash = keccak256(abi.encode(_files, _user, _access_type, _validity, _nonce));
        address _identity = getSigner(payloadHash, signer, v, r, s);
        for (uint j = 0; j < _files.length; j++) {
            require(_identity == owners[_files[j]], "Owner does not match");
            require(_validity[j] != 0, "Validity must be non zero");
            accessSpecifier[_files[j]][_access_type[j]][_user] = ACK(now.add(_validity[j]), version[_files[j]]);
            userAccess[_files[j]][_access_type[j]].push(_user);
            emit NewShare(_identity, _files[j], _user, _access_type[j], _validity[j], _nonce);
        }
        nonce[signer][_nonce] = true;
    }

    event NewFileUpdate(
        address indexed identity,
        bytes32 indexed file,
        uint256 n,
        uint256 k,
        uint256 file_size,
        bytes indexed ueb
    );

    event NewDownload(
        address indexed identity,
        bytes32 indexed file,
        uint256 validity,
        bytes32 access_type
    );


    function downloadSigned(bytes32 _file, bytes32 _access_type, address signer, uint256 _nonce, uint8 v, bytes32 r, bytes32 s) onlyNode public returns (uint256) {
        require(!nonce[signer][_nonce], "None already used");
        bytes32 payloadHash = keccak256(abi.encode(_file, _access_type, _nonce));
        address _identity = getSigner(payloadHash, signer, v, r, s);
        ACK memory ack = accessSpecifier[_file][_access_type][_identity];
        uint256 validity = ack.validity;
        if (_identity == owners[_file]) {
            validity = now.add(1000000);
        } else {
            require(ack.version == version[_file], "Version of file doesn't match");
            require(validity != uint256(0), "Validity is 0");
        }
        nonce[signer][_nonce] = true;
        emit NewDownload(_identity, _file, validity, _access_type);
        return validity;
    }


    function IndexOf(address[] memory values, address value) internal pure returns (uint) {
        uint i = 0;
        while (values[i] != value) {
            i++;
        }
        return i;
    }

    event NewUpdateACK(
        address indexed identity,
        bytes32 indexed file,
        address indexed user,
        bytes32 access_type
    );


    /**
    * @dev Update ACK(Access Control Key) validity, it can not be used to change access_type, to change you have to share the
    file again with desired access type and you may remove the previous access type
    * @return bool
    */
    function revokeSigned(bytes32 _file, address _user, bytes32 _access_type, address signer, uint256 _nonce, uint8 v, bytes32 r, bytes32 s) onlyNode public {
        require(!nonce[signer][_nonce], "None already used");
        bytes32 payloadHash = keccak256(abi.encode(_file, _user, _access_type, _nonce));
        address _identity = getSigner(payloadHash, signer, v, r, s);
        require(_identity == owners[_file], "Owner does not match");
        delete accessSpecifier[_file][_access_type][_user];
        uint index = IndexOf(userAccess[_file][_access_type], _user);
        delete userAccess[_file][_access_type][index];
        nonce[signer][_nonce] = true;
        emit NewUpdateACK(_identity, _file, _user, _access_type);
    }


    function changeOwnerSigned(bytes32 _file, address _new_owner, address signer, uint256 _nonce, uint8 v, bytes32 r, bytes32 s) onlyNode public {
        require(!nonce[signer][_nonce], "None already used");
        require(_new_owner != address(0), "Invalid address");
        bytes32 payloadHash = keccak256(abi.encode(_file, _new_owner, _nonce));
        address actualSigner = getSigner(payloadHash, signer, v, r, s);
        require(actualSigner == owners[_file], "Owner does not match");
        owners[_file] = _new_owner;
        nonce[signer][_nonce] = true;
    }

}
