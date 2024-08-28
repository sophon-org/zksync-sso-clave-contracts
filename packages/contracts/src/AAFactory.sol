// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

import "hardhat/console.sol";

contract AAFactory {
    bytes32 public testAaBytecodeHash;
    bytes32 public proxyAaBytecodeHash;

    struct MetaAccountConnection {
        address accountLocation;
        string publicPasskey; // used for addtional on-chain validation
    }

    // This 4 step mapping prevents collisions and does the lookup from public to private information
    // login provider => unique id => creator => account info
    mapping(string => mapping(string => mapping(address => MetaAccountConnection)))
        public accountMappings;

    constructor(bytes32 _testAaBytecodeHash, bytes32 _proxyAaBytecodeHash) {
        testAaBytecodeHash = _testAaBytecodeHash;
        proxyAaBytecodeHash = _proxyAaBytecodeHash;
    }

    function deployProxy7579Account(
        bytes32 salt,
        address accountImplementionLocation
    ) external returns (address accountAddress) {
        (bool success, bytes memory returnData) = SystemContractsCaller
            .systemCallWithReturndata(
                uint32(gasleft()),
                address(DEPLOYER_SYSTEM_CONTRACT),
                uint128(0),
                abi.encodeCall(
                    DEPLOYER_SYSTEM_CONTRACT.create2Account,
                    (
                        salt,
                        proxyAaBytecodeHash,
                        abi.encode(accountImplementionLocation),
                        IContractDeployer.AccountAbstractionVersion.Version1
                    )
                )
            );
        require(success, "Deployment failed");

        (accountAddress) = abi.decode(returnData, (address));
    }

    /**
     * This is a test harness to deploy a simple account with the factory-registry
     */
    function deployLinkedSocialAccount(
        bytes32 salt,
        string calldata uniqueUserId,
        string calldata socialType,
        address owner
    ) external returns (address accountAddress) {
        (bool success, bytes memory returnData) = SystemContractsCaller
            .systemCallWithReturndata(
                uint32(gasleft()),
                address(DEPLOYER_SYSTEM_CONTRACT),
                uint128(0),
                abi.encodeCall(
                    DEPLOYER_SYSTEM_CONTRACT.create2Account,
                    (
                        salt,
                        testAaBytecodeHash,
                        abi.encode(owner),
                        IContractDeployer.AccountAbstractionVersion.Version1
                    )
                )
            );
        require(success, "Deployment failed");

        (accountAddress) = abi.decode(returnData, (address));

        // XXX: (TODO) Does not YET verify ownership of social id when creating
        mapping(string => mapping(address => MetaAccountConnection))
            storage accountEmbeddings = accountMappings[socialType];
        mapping(address => MetaAccountConnection)
            storage loginAccount = accountEmbeddings[uniqueUserId];
        MetaAccountConnection storage userAccount = loginAccount[msg.sender];

        // fail if the creator wants multiple accounts per login
        require(
            userAccount.accountLocation != accountAddress &&
                (accountAddress != address(0)),
            "Account already linked"
        );

        userAccount.accountLocation = accountAddress;
    }

    function setLinkedEmbeddedAccountPasskey(
        string calldata socialType,
        string calldata uniqueUserId,
        address updating,
        address creator,
        string calldata publicPasskey
    ) public {
        // XXX: (TODO) Does not YET verify ownership of social id when creating
        mapping(string => mapping(address => MetaAccountConnection))
            storage accountEmbeddings = accountMappings[socialType];
        mapping(address => MetaAccountConnection)
            storage loginAccount = accountEmbeddings[uniqueUserId];
        MetaAccountConnection storage userAccount = loginAccount[creator];

        // fail if the account doesn't exist yet!
        require(
            userAccount.accountLocation == updating && updating != address(0),
            "Account does not yet exist"
        );
        userAccount.publicPasskey = publicPasskey;
    }
}
