// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IERC7579Module.sol";

import {IERC7579Module} from "../interfaces/IERC7579Module.sol";
import {IR1Validator} from "../interfaces/IValidator.sol";

/**
 * Looking to combine with the validator to ensure that the spend limit is touched
 * Working on using the 7579 module + zksync validator
 * Flow is create passkey with optional spend-limit (as a validator)
 * have that passkey create a time & spend limited session key,
 * then reject transactions (as a validator) when the session key expires.
 */
contract SessionPasskeySpendLimitModule is IERC7579Module {
    struct SessionKey {
        address publicKey; // usable for ecrecover
        uint256 validUntilBlockTimestamp; // to stop validation after this timestamp
    }

    bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

    struct SpendingLimit {
        uint256 limit; // running token transfer
        bytes publicKey; // webauthn passkey *77 bytes*
        SessionKey[] sessionKeys; // temporary public keys
        mapping(uint256 timeperiod => uint256) spent; // timestamp per transfer
    }

    struct TokenConfig {
        address token; // ERC20 location
        bytes publicKey; // webauthn passkey
        uint256 limit; // no decimals
    }

    // one passkey per token
    mapping(address account => mapping(address token => SpendingLimit))
        public spendingLimits;
    // complete list of configured tokens per address
    mapping(address account => address[]) tokens;

    // session key to account mapping (flattening spending limit)
    mapping(address sessionPublicKey => mapping(address accountAddress => uint256 expiration)) sessionToAccount;

    /* array of token spend limit configurations (sane defaults)
     * @param data TokenConfig[]
     */
    function onInstall(bytes calldata data) external override {
        TokenConfig[] memory configs = abi.decode(data, (TokenConfig[]));
        for (uint256 i = 0; i < configs.length; i++) {
            spendingLimits[msg.sender][configs[i].token].limit = configs[i]
                .limit;
            spendingLimits[msg.sender][configs[i].token].publicKey = configs[i]
                .publicKey;
            tokens[msg.sender].push(configs[i].token);
        }
    }

    /* Remove all the spending limits for the message sender
     * @param data (unused, but needed to satisfy interfaces)
     */
    function onUninstall(bytes calldata) external override {
        for (uint256 i = 0; i < tokens[msg.sender].length; i++) {
            delete spendingLimits[msg.sender][tokens[msg.sender][i]];
        }
        delete tokens[msg.sender];
    }

    /*
     * If there are any spend limits configured
     * @param smartAccount The smart account to check
     * @return true if spend limits are configured initialized, false otherwise
     */
    function isInitialized(address smartAccount) external view returns (bool) {
        return tokens[smartAccount].length > 0;
    }

    /*
     * Update spend limit of sender for provided tokens in list
     * @param configs TokenConfig[] to update
     */
    function setSpendingLimits(TokenConfig[] calldata configs) external {
        for (uint256 i = 0; i < configs.length; i++) {
            // saving limit and passkey, but not session keys on creation
            spendingLimits[msg.sender][configs[i].token].limit = configs[i]
                .limit;
            spendingLimits[msg.sender][configs[i].token].publicKey = configs[i]
                .publicKey;

            tokens[msg.sender].push(configs[i].token);
        }
    }

    function removeSpendingLimit(address token) external {
        delete spendingLimits[msg.sender][token];
    }

    /*
     * Currently doing 1271 validation, but might update the interface to match the zksync account validation
     */
    function isValidSignature(
        bytes32 _hash,
        bytes memory _signature
    ) public view returns (bytes4 magic) {
        magic = EIP1271_SUCCESS_RETURN_VALUE;

        if (_signature.length != 65) {
            // Signature is invalid anyway, but we need to proceed with the signature verification as usual
            // in order for the fee estimation to work correctly
            _signature = new bytes(65);

            // Making sure that the signatures look like a valid ECDSA signature and are not rejected rightaway
            // while skipping the main verification process.
            _signature[64] = bytes1(uint8(27));
        }

        // XXX: requires embedding the account in the signature,
        // otherwise it's not clear which account to validate against
        // this also probably throws off other alignments later
        address expectedAccountAddress = address(0);
        abi.decode(_signature, (address, bytes));

        // extract ECDSA signature
        uint8 v;
        bytes32 r;
        bytes32 s;
        // Signature loading code
        // we jump 32 (0x20) as the first slot of bytes contains the length
        // we jump 65 (0x41) per signature
        // for v we load 32 bytes ending with v (the first 31 come from s) then apply a mask
        assembly {
            r := mload(add(_signature, 0x20))
            s := mload(add(_signature, 0x40))
            v := and(mload(add(_signature, 0x41)), 0xff)
        }

        if (v != 27 && v != 28) {
            magic = bytes4(0);
        }

        // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
        // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
        // the valid range for s in (301): 0 < s < secp256k1n ÷ 2 + 1, and for v in (302): v ∈ {27, 28}. Most
        // signatures from current libraries generate a unique signature with an s-value in the lower half order.
        //
        // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value
        // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or
        // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept
        // these malleable signatures as well.
        if (
            uint256(s) >
            0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
        ) {
            magic = bytes4(0);
        }

        address recoveredAddress = ecrecover(_hash, v, r, s);

        // check expiration date via unique mapping
        uint256 timeperiod = block.timestamp / 1 weeks;
        if (
            sessionToAccount[recoveredAddress][msg.sender] > timeperiod &&
            recoveredAddress != address(0)
        ) {
            // Note, that we should abstain from using the require here in order to allow for fee estimation to work
            magic = bytes4(0);
        }
    }

    /*
     * For ERC20 transfers, compare the token contract address (target)
     * with any spend limits configured for the account.
     * Revert if the spend-limit has been exceeded
     */
    function _checkSpendingLimit(
        address target,
        bytes calldata callData
    ) internal {
        
        // Get the spending limit
        SpendingLimit storage config = spendingLimits[msg.sender][target];
        uint256 timeperiod = block.timestamp / 1 weeks;
        if (config.limit != 0) {
            (, uint256 value) = abi.decode(callData[4:], (address, uint256));
            if (config.spent[timeperiod] + value > config.limit) {
                revert("SpendingLimitHook: spending limit exceeded");
            } else {
                config.spent[timeperiod] += value;
            }
        }
    }

    // check the spending limit of the target for the transaction
    function onExecute(
        address account,
        address msgSender,
        address target,
        uint256 value,
        bytes calldata callData
    ) internal virtual returns (bytes memory hookData) {}

    /**
     * The name of the module
     * @return name The name of the module
     */
    function name() external pure returns (string memory) {
        return "SessionPasskeySpendLimitModule";
    }

    /**
     * Currently in dev
     * @return version The version of the module
     */
    function version() external pure returns (string memory) {
        return "0.0.0";
    }

    /*
     * Does validation and hooks transaction depending on the key
     * @param typeID The type ID to check
     * @return true if the module is of the given type, false otherwise
     */
    function isModuleType(
        uint256 typeID
    ) external pure override returns (bool) {
        return typeID == MODULE_TYPE_VALIDATOR;
    }

    /*
     * CALLDATA DECODING - this needs to check 2 things:
     * 1. Does this transaction contain an ERC20 transfer?
     * 2. What is the token contract address for this transfer
     * @return address the token contract for the transfer, otherwise 0
     */
    function _preCheckParsing(
        address msgSender,
        uint256 msgValue,
        bytes calldata msgData
    ) internal returns (address tokenAddress) {
        require(
            bytes4(msgData[2:10]) == IERC20.transfer.selector || bytes4(msgData[2:10]) == IERC20.transferFrom.selector,
            "Must perform ERC20 transfer"
        );
        // XXX: not sure if the offsets here are correct given that this is being used with a smart account
        tokenAddress = address(bytes20(msgData[16:35]));
    }

    /**
     * Get the sender of the transaction
     *
     * @return account the sender of the transaction
     */
    function _getAccount() internal view returns (address account) {
        account = msg.sender;
        address _account;
        address forwarder;
        if (msg.data.length >= 40) {
            assembly {
                _account := shr(96, calldataload(sub(calldatasize(), 20)))
                forwarder := shr(96, calldataload(sub(calldatasize(), 40)))
            }
            if (forwarder == msg.sender) {
                account = _account;
            }
        }
    }

    /*
     * Look at the transaction data to parse out what needs to be done
     */
    function preCheck(
        address msgSender,
        uint256 msgValue,
        bytes calldata msgData
    ) external returns (bytes memory hookData) {
        _checkSpendingLimit(
            _preCheckParsing(msgSender, msgValue, msgData),
            msgData
        );
    }

    /*
     * Validate data from the pre-check hook after the transaction is executed
     */
    function postCheck(bytes calldata hookData) external {}

    /*
     * requires validating the passkey (!?)
     */
    function addSessionKey(
        address publicKey,
        address token,
        uint256 expiration
    ) external {
        spendingLimits[msg.sender][token].sessionKeys.push(
            SessionKey(publicKey, expiration)
        );
        sessionToAccount[publicKey][msg.sender] = expiration;
    }
}
