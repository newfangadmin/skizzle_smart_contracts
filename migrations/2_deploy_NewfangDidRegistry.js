const DID = artifacts.require("NewfangDIDRegistry");

module.exports = function (deployer) {
    deployer.deploy(DID);
};
