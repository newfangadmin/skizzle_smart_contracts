pragma solidity ^0.5;

import './SafeMath.sol';
import './Initializable.sol';

contract Skizzle is Initializable {
    address public owner;
    using SafeMath for uint;
    bytes32 public log;

    // keccak256(storage index) => bytes32 newfang-specific-idbytes
    mapping(bytes32 => address) public owners; // file owners
    // file id => access type => user => validity
    mapping(bytes32 => mapping(bytes32 => mapping(address => uint256))) public accessSpecifier;
    // It is used to get all users of a particular type with particular access
    mapping(bytes32 => mapping(bytes32 => address[])) public userAccess;
    mapping(address => uint) public nonce;
    mapping(bytes32 => File) public files;
    mapping(bytes32 => Access) accessTypes;
    mapping(address => Usage[]) usages;
    address[] public nodes;

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
        bool flag = false;
        for (uint256 i = 0; i < nodes.length; i++) {
            if (msg.sender == nodes[i]) {
                flag = true;
                break;
            }
        }
        require(flag);
        _;
    }


    function initialize(address sender) public initializer {
        owner = sender;
    }

    function total_nodes() view public returns(uint256){
        return nodes.length;
    }

    function addNode(address _node) public onlyOwner {
        nodes.push(_node);
    }

    function deleteNode() public onlyOwner {
        delete nodes;
    }

    function getSigner(bytes32 payloadHash, address signer, uint8 v, bytes32 r, bytes32 s) public pure returns (address){
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
        address actualSigner = ecrecover(messageHash, v, r, s);
        require(signer == actualSigner);
        return actualSigner;
    }


    function createDIDSigned(bytes32 _file, uint256 n, uint256 k, uint256 _file_size, address signer, uint8 v, bytes32 r, bytes32 s) public {
        require(owners[_file] == address(0), "Owner already exist for this file");
        require(n <= nodes.length, "N should be less then number of total nodes");
        require(n > k, "n>k");
        require(k > 1, "k should not be 0");
        require(_file_size != 0, "Should not be 0");
        bytes32 payloadHash = keccak256(abi.encode(_file, n, k, _file_size,nonce[signer]));
        address _identity = getSigner(payloadHash, signer, v, r, s);
        owners[_file] = _identity;
        files[_file] = File(n, k, _file_size, msg.sender, "");
        nonce[_identity]++;
    }

    event deleteFileEvent(
        address indexed identity,
        bytes32 indexed file
    );


    function deleteFileSigned(bytes32 _id, address signer, uint8 v, bytes32 r, bytes32 s) public onlyNode {
        bytes32 payloadHash = keccak256(abi.encode(_id, nonce[signer]));
        address _identity = getSigner(payloadHash, signer, v, r, s);
        require(owners[_id] == _identity, "Owner does not match");

        // Remove access of all the users
        address[] memory users;
        address user;
        for (uint at = 0; at < accessTypes[_id].types.length; at++) {
            users = userAccess[_id][accessTypes[_id].types[at]];
            for (uint i = 0; i < users.length; i++) {
                user = userAccess[_id][accessTypes[_id].types[at]][i];
                delete accessSpecifier[_id][accessTypes[_id].types[at]][user];
                delete userAccess[_id][accessTypes[_id].types[at]][i];
            }
        }
        // end remove access of all users

        // Remove file
        delete files[_id];

        // Remove file owner
        delete owners[_id];

        nonce[_identity]++;
        emit deleteFileEvent(_identity, _id);
    }


    function getTotalUsers(bytes32 _file, bytes32 _access_type) public view returns (uint256){
        address[] memory users = userAccess[_file][_access_type];
        address user;
        uint256 count = 0;
        for (uint i = 0; i < users.length; i++) {
            user = userAccess[_file][_access_type][i];
            if (user != address(0) && accessSpecifier[_file][_access_type][user] > now) {
                count = count.add(1);
            }
        }
        return count;
    }

    function getAllUsers(bytes32 _file, bytes32 _access_type) public view returns (address[] memory){
        address[] memory users = userAccess[_file][_access_type];
        address user;
        for (uint i = 0; i < users.length; i++) {
            user = userAccess[_file][_access_type][i];
            if (accessSpecifier[_file][_access_type][user] <= now) {
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
    function shareSigned(bytes32[] memory _files, address[] memory _user, bytes32[] memory _access_type, uint256[] memory _validity, address signer, uint8 v, bytes32 r, bytes32 s) onlyNode public {
        bytes32 payloadHash = keccak256(abi.encode(_files, _user, _access_type, _validity, nonce[signer]));
        address _identity = getSigner(payloadHash, signer, v, r, s);
        for (uint j = 0; j < _files.length; j++) {
            for (uint i = 0; i < _user.length; i++) {
                require(_identity == owners[_files[j]]);
                require(_validity[i] != 0, "Validity must be non zero");
                accessSpecifier[_files[j]][_access_type[i]][_user[i]] = now.add(_validity[i]);
                userAccess[_files[j]][_access_type[i]].push(_user[i]);
                emit NewShare(_identity, _files[j], _user[i], _access_type[i], _validity[i], nonce[_identity]);

                // Keep track of access types defined for a particular file
                if (!accessTypes[_files[j]].is_in[_access_type[i]]) {
                    accessTypes[_files[j]].types.push(_access_type[i]);
                    accessTypes[_files[j]].is_in[_access_type[i]] = true;
                }

            }
        }
        nonce[_identity]++;
    }

    event NewFileUpdate(
        address indexed identity,
        bytes32 indexed file,
        uint256 n,
        uint256 k,
        uint256 file_size,
        bytes indexed ueb
    );

    function fileUpdate(bytes32 _file, bytes memory ueb) public onlyNode returns (bool){
        File storage file = files[_file];
        require(msg.sender == file.handling_node, "Function can only be called by handling node");
        file.ueb = ueb;
        emit NewFileUpdate(owners[_file], _file, file.n, file.k, file.file_size, ueb);
        return true;
    }

    event NewDownload(
        address indexed identity,
        bytes32 indexed file,
        uint256 validity,
        bytes32 access_type
    );


    function downloadSigned(bytes32 _file, bytes32 _access_type, address signer, uint8 v, bytes32 r, bytes32 s) onlyNode public returns (uint256) {
        bytes32 payloadHash = keccak256(abi.encode(_file, _access_type, nonce[signer]));
        address _identity = getSigner(payloadHash, signer, v, r, s);
        uint256 validity = accessSpecifier[_file][_access_type][_identity];
        if (_identity == owners[_file]) {
            validity = now.add(1000000);
        } else {
            require(validity != uint256(0), "Validity is 0");
        }
        nonce[_identity]++;
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
        bytes32 access_type,
        uint256 validity
    );


    /**
    * @dev Update ACK(Access Control Key) validity, it can not be used to change access_type, to change you have to share the
    file again with desired access type and you may remove the previous access type
    * @return bool
    */
    function updateACKSigned(bytes32 _file, address _user, bytes32 _access_type, uint256 _validity, address signer, uint8 v, bytes32 r, bytes32 s) onlyNode public {
        bytes32 payloadHash = keccak256(abi.encode(_file, _user, _access_type, _validity, nonce[signer]));
        address _identity = getSigner(payloadHash, signer, v, r, s);
        accessSpecifier[_file][_access_type][_user] = now.add(_validity);
        if (_validity == 0) {
            delete accessSpecifier[_file][_access_type][_user];
            uint index = IndexOf(userAccess[_file][_access_type], _user);
            delete userAccess[_file][_access_type][index];
        }
        if (!accessTypes[_file].is_in[_access_type]) {// check if access type is already declared
            accessTypes[_file].types.push(_access_type);
            // push the new access type
            accessTypes[_file].is_in[_access_type] = true;
        }
        nonce[_identity]++;
        emit NewUpdateACK(_identity, _file, _user, _access_type, _validity);
    }



    /**
    * @dev Change file Owner
    * @return bool
    */
    function changeFileOwner(address _identity, bytes32 _file, address _new_owner) internal onlyFileOwner(_file, _identity) returns (bool){
        require(_new_owner != address(0), "Invalid address");
        owners[_file] = _new_owner;
        nonce[_identity]++;
        return true;
    }

    function changeOwnerSigned(bytes32 _file, address _new_owner, address signer, uint8 v, bytes32 r, bytes32 s) onlyNode public returns (bool) {
        bytes32 payloadHash = keccak256(abi.encode(_file, _new_owner, nonce[signer]));
        address actualSigner = getSigner(payloadHash, signer, v, r, s);
        return changeFileOwner(actualSigner, _file, _new_owner);
    }

}
