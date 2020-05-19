pragma solidity ^0.5;

import './NewfangDIDRegistry.sol';

contract NewfangDIDRegistryV2 is NewfangDIDRegistry {

    function email(bytes32 _file_id, uint256 n, uint256 k, uint256 file_size, bytes memory ueb) public {
        createDID(_file_id, msg.sender);
        fileUpdate(msg.sender, _file_id, n, k, file_size, ueb);
    }

}
