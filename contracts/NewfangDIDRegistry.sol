pragma solidity ^0.5;

import './SafeMath.sol';

contract NewfangDIDRegistry {
    using SafeMath for uint;
    bytes32 public log;


    // keccak256(storage index) => bytes32 newfang-specific-idstring
    mapping(bytes32 => address) public owners; // file owners
    // file id => access type => user => access control key
    mapping(bytes32 => mapping(bytes32 => mapping(address => uint256))) public accessSpecifier;
    // It is used to get all users of a particular type with particular access
    mapping(bytes32 => mapping(bytes32 => address[])) public userAccess;
    mapping(address => uint) public nonce;
    mapping(bytes32 => File) public files;
    mapping(bytes32 => Access) accessTypes;
    mapping(address => Usage[]) usages;
    address public owner;

    // similar to sets
    struct Access {
        bytes32[] types;
        mapping(bytes32 => bool) is_in;
    }

    struct File {
        uint256 n;
        uint256 k;
        uint256 file_size;
        string ueb;
    }

    struct Usage {
        uint256 total_bytes;
        bytes32 usage_type; // 0 => upload; 1 => download
        bytes32 file;
    }

    constructor () public {
        owner = msg.sender;
    }

    modifier onlyFileOwner(bytes32 _file, address _identity) {
        require(_identity == owners[_file]);
        _;
    }



    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }


    function getSigner(bytes32 payloadHash, address signer, uint8 v, bytes32 r, bytes32 s) public pure returns (address){
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
        address actualSigner = ecrecover(messageHash, v, r, s);
        require(signer == actualSigner);
        return actualSigner;
    }


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

    /**
    * @dev _id will be the file index which is generated by newfang SDK on client side.
    * @return bool
    */
    function createDID(bytes32 _id) public returns (bool){
        return createDID(_id, msg.sender);
    }

    function createDIDSigned(bytes32 _id, address signer, uint8 v, bytes32 r, bytes32 s) public returns (bool) {
        bytes32 payloadHash = keccak256(abi.encode(_id, nonce[signer]));
        address actualSigner = getSigner(payloadHash, signer, v, r, s);
        return createDID(_id, actualSigner);
    }


    function removeDID(bytes32 _id, address _identity) internal returns (bool) {
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
        return true;
    }

    function removeDID(bytes32 _id) public returns (bool){
        return removeDID(_id, msg.sender);
    }

    function removeDIDSigned(bytes32 _id, address signer, uint8 v, bytes32 r, bytes32 s) public returns (bool) {
        bytes32 payloadHash = keccak256(abi.encode(_id, nonce[signer]));
        address actualSigner = getSigner(payloadHash, signer, v, r, s);
        return removeDID(_id, actualSigner);
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


    /**
    * @dev key is encrypted with users public key and stored on a server hash of encrypted key is stored here in smart
     contract along with its validity
    * @return bool
    */
    function share(address _identity, bytes32[] memory _files, address[] memory _user, bytes32[] memory _access_type, uint256[] memory _validity) internal returns (bool){
        for (uint j = 0; j < _files.length; j++) {
            for (uint i = 0; i < _user.length; i++) {
                require(_identity == owners[_files[j]]);
                require(_validity[i] != 0, "Validity must be non zero");
                //                ACK memory ack = accessSpecifier[_files[j]][_access_type[i]][_user[i]];
                //                require(ack == 0, "Already shared with user");
                accessSpecifier[_files[j]][_access_type[i]][_user[i]] = now.add(_validity[i]);
                userAccess[_files[j]][_access_type[i]].push(_user[i]);

                if (!accessTypes[_files[j]].is_in[_access_type[i]]) {
                    accessTypes[_files[j]].types.push(_access_type[i]);
                    accessTypes[_files[j]].is_in[_access_type[i]] = true;
                }

            }
        }

        nonce[_identity]++;
        return true;
    }

    function share(bytes32[] memory _file, address[] memory _user, bytes32[] memory _access_type, uint256[] memory _validity) public returns (bool){
        return share(msg.sender, _file, _user, _access_type, _validity);
    }


    function shareSigned(bytes32[] memory _file, address[] memory _user, bytes32[] memory _access_type, uint256[] memory _validity, address signer, uint8 v, bytes32 r, bytes32 s) public returns (bool) {
        bytes32 payloadHash = keccak256(abi.encode(_file, _user, _access_type, _validity, nonce[signer]));
        address actualSigner = getSigner(payloadHash, signer, v, r, s);
        return share(actualSigner, _file, _user, _access_type, _validity);
    }

    function fileUpdate(address _identity, bytes32 _file, uint256 n, uint256 k, uint256 file_size, string memory ueb) internal onlyFileOwner(_file, _identity) returns (bool){
        require(owners[_file] != address(0), "File does not has an owner");
        require(n > k, "n>k");
        require(k > 1, "k should not be 0");
        require(file_size != 0, "Should not be 0");
        files[_file] = File(n, k, file_size, ueb);
        nonce[_identity]++;
        return true;
    }

    function fileUpdate(bytes32 _file, uint256 n, uint256 k, uint256 file_size, string memory ueb) public returns (bool){
        return fileUpdate(msg.sender, _file, n, k, file_size, ueb);
    }

    function fileUpdateSigned(bytes32 _file, uint256 n, uint256 k, uint256 file_size, string memory ueb, address signer, uint8 v, bytes32 r, bytes32 s) public returns (bool){
        bytes32 payloadHash = keccak256(abi.encode(_file, n, k, file_size, ueb, nonce[signer]));
        address actualSigner = getSigner(payloadHash, signer, v, r, s);
        return fileUpdate(actualSigner, _file, n, k, file_size, ueb);
    }

    event KeyHash(
        address user,
        uint256 validity
    );

    function getKeyHash(address _identity, bytes32 _file, bytes32 _access_type) internal returns (uint256){
        uint256 validity = accessSpecifier[_file][_access_type][_identity];
        nonce[_identity]++;
        emit KeyHash(_identity, validity);
        return (validity);
    }


    /**
    * @dev Fetch ACK hash of user
    * @return encrypted hash and validity
    */
    function getKeyHash(bytes32 _file, bytes32 _access_type) public returns (uint256){
        return getKeyHash(msg.sender, _file, _access_type);
    }

    function getKeyHashSigned(bytes32 _file, bytes32 _access_type, address signer, uint8 v, bytes32 r, bytes32 s) public returns (uint256) {
        bytes32 payloadHash = keccak256(abi.encode(_file, _access_type, nonce[signer]));
        address actualSigner = getSigner(payloadHash, signer, v, r, s);
        return getKeyHash(actualSigner, _file, _access_type);
    }


    function IndexOf(address[] memory values, address value) internal pure returns (uint) {
        uint i = 0;
        while (values[i] != value) {
            i++;
        }
        return i;
    }

    /**
    * @dev Update ACK(Access Control Key) validity, it can not be used to change access_type, to change you have to share the
    file again with desired access type and you may remove the previous access type
    * @return bool
    */
    function updateACK(address _identity, bytes32 _file, address _user, bytes32 _access_type, uint256 _validity) internal onlyFileOwner(_file, _identity) returns (bool){
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
        return true;
    }

    function updateACK(bytes32 _file, address _user, bytes32 _access_type, uint256 _validity) public returns (bool){
        return updateACK(msg.sender, _file, _user, _access_type, _validity);
    }

    function updateACKSigned(bytes32 _file, address _user, bytes32 _access_type, uint256 _validity, address signer, uint8 v, bytes32 r, bytes32 s) public returns (bool) {
        bytes32 payloadHash = keccak256(abi.encode(_file, _user, _access_type, _validity, nonce[signer]));
        address actualSigner = getSigner(payloadHash, signer, v, r, s);
        return updateACK(actualSigner, _file, _user, _access_type, _validity);
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

    function changeFileOwner(bytes32 _file, address _new_owner) public returns (bool){
        return changeFileOwner(msg.sender, _file, _new_owner);
    }

    function changeOwnerSigned(bytes32 _file, address _new_owner, address signer, uint8 v, bytes32 r, bytes32 s) public returns (bool) {
        bytes32 payloadHash = keccak256(abi.encode(_file, _new_owner, nonce[signer]));
        address actualSigner = getSigner(payloadHash, signer, v, r, s);
        return changeFileOwner(actualSigner, _file, _new_owner);
    }

    /**
    * @dev This function is used for billing purpose. Usage is stored in the contract and bills are calculated off chain
    */
    function addUsage(address _identity, uint256 _total_bytes, bytes32 _type, bytes32 _file) internal {
        Usage memory usage = Usage(_total_bytes, _type, _file);
        usages[_identity].push(usage);
        nonce[_identity]++;
    }

    //    function addUsage(uint256 _total_bytes, bytes32 _type, bytes32 _file) public {
    //        addUsage(msg.sender, _total_bytes, _type, _file);
    //    }
    //
    //
    //    function addUsageSigned(uint256 _total_bytes, bytes32 _type, bytes32 _file, address signer, uint8 v, bytes32 r, bytes32 s) public {
    //        bytes32 payloadHash = keccak256(abi.encode(_total_bytes, _type, _file,nonce[signer]));
    //        address actualSigner = getSigner(payloadHash, signer, v, r, s);
    //        addUsage(actualSigner, _total_bytes, _type, _file);
    //    }

    /**
    * @dev this function is the combination of createDID, fileUpdate
    */
    function email(address _identity, bytes32 _file_id, uint256 n, uint256 k, uint256 file_size, string memory ueb) internal {
        createDID(_file_id, _identity);
        fileUpdate(_identity, _file_id, n, k, file_size, ueb);
    }

    function email(bytes32 _file_id, uint256 n, uint256 k, uint256 file_size, string memory ueb) public {
        createDID(_file_id, msg.sender);
        fileUpdate(msg.sender, _file_id, n, k, file_size, ueb);
    }
}
