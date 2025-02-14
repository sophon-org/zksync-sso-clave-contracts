// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { ISsoAccount } from "../interfaces/ISsoAccount.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { IModule } from "../interfaces/IModule.sol";
import { VerifierCaller } from "../helpers/VerifierCaller.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64 } from "solady/src/utils/Base64.sol";
import { JSONParserLib } from "solady/src/utils/JSONParserLib.sol";

/// @title WebAuthValidator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @dev This contract allows secure user authentication using WebAuthn public keys.
contract WebAuthValidator is VerifierCaller, IModuleValidator {
  using JSONParserLib for JSONParserLib.Item;
  using JSONParserLib for string;

  /// @dev P256Verify precompile implementation, as defined in RIP-7212, is found at
  /// https://github.com/matter-labs/era-contracts/blob/main/system-contracts/contracts/precompiles/P256Verify.yul
  address private constant P256_VERIFIER = address(0x100);

  // check for secure validation: bit 0 = 1 (user present), bit 2 = 1 (user verified)
  bytes1 private constant AUTH_DATA_MASK = 0x05;
  bytes32 private constant LOW_S_MAX = 0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8;
  bytes32 private constant HIGH_R_MAX = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551;

  event PasskeyCreated(address indexed keyOwner, string originDomain, bytes credentialId);
  event PasskeyRemoved(address indexed keyOwner, string originDomain, bytes credentialId);

  error AccountAlreadyRegistered(string originDomain, bytes credentialId);

  // The layout is unusual due to EIP-7562 storage read restrictions for validation phase.
  mapping(string originDomain => mapping(bytes credentialId => mapping(address accountAddress => bytes32 publicKey)))
    public lowerKeyHalf;
  mapping(string originDomain => mapping(bytes credentialId => mapping(address accountAddress => bytes32 publicKey)))
    public upperKeyHalf;

  // so you can check if you are using this passkey on this or related domains
  mapping(string originDomain => mapping(bytes credentialId => address accountAddress)) public keyExistsOnDomain;
  mapping(string originDomain => mapping(address accountAddress => bytes[] credentialIds)) public domainAccountKeys;

  /// @notice A mapping that marks account IDs as being reserved for use, but not yet working.
  /// @dev This is used to prevent the same account ID from being used for recovery, deployment and future uses.
  mapping(string originDomain => mapping(bytes credentialId => address accountAddress)) public reservedAccountIds;

  struct PasskeyId {
    string domain;
    bytes credentialId;
  }

  /// @notice Runs on module install
  /// @param data ABI-encoded WebAuthn passkey to add immediately, or empty if not needed
  function onInstall(bytes calldata data) external override {
    if (data.length > 0) {
      (bytes memory credentialId, bytes32[2] memory rawPublicKey, string memory originDomain) = abi.decode(
        data,
        (bytes, bytes32[2], string)
      );
      require(addValidationKey(credentialId, rawPublicKey, originDomain), "WebAuthValidator: key already exists");
    }
  }

  /// @notice Runs on module uninstall
  /// @param data ABI-encoded array of origin domains to remove keys for
  function onUninstall(bytes calldata data) external override {
    PasskeyId[] memory passkeyIds = abi.decode(data, (PasskeyId[]));
    for (uint256 i = 0; i < passkeyIds.length; i++) {
      PasskeyId memory passkeyId = passkeyIds[i];
      _removeValidationKey(passkeyId.credentialId, passkeyId.domain);
    }
  }

  function removeValidationKey(bytes calldata credentialId, string calldata domain) external {
    return _removeValidationKey(credentialId, domain);
  }

  function _removeValidationKey(bytes memory credentialId, string memory domain) internal {
    lowerKeyHalf[domain][credentialId][msg.sender] = 0x0;
    upperKeyHalf[domain][credentialId][msg.sender] = 0x0;
    if (keyExistsOnDomain[domain][credentialId] == msg.sender) {
      keyExistsOnDomain[domain][credentialId] = address(0);
      bytes[] storage keys = domainAccountKeys[domain][msg.sender];
      for (uint256 i = 0; i < keys.length; i++) {
        if (keccak256(keys[i]) == keccak256(credentialId)) {
          // If found last account is moved to current position, and then
          // last element is removed from array.
          keys[i] = keys[keys.length - 1];
          keys.pop();
          break;
        }
      }
    }
    emit PasskeyRemoved(msg.sender, domain, credentialId);
  }

  /// @notice Adds a WebAuthn passkey for the caller
  /// @param credentialId unique public identifier for the key
  /// @param rawPublicKey ABI-encoded WebAuthn public key to add
  /// @param originDomain the domain this associated with
  /// @return true if the key was added, false if one already exists
  function addValidationKey(
    bytes memory credentialId,
    bytes32[2] memory rawPublicKey,
    string memory originDomain
  ) public returns (bool) {
    bytes32 initialLowerHalf = lowerKeyHalf[originDomain][credentialId][msg.sender];
    bytes32 initialUpperHalf = upperKeyHalf[originDomain][credentialId][msg.sender];
    if (uint256(initialLowerHalf) != 0 || uint256(initialUpperHalf) != 0) {
      return false;
    }
    if (keyExistsOnDomain[originDomain][credentialId] != address(0)) {
      // this key already exists on the domain (but it was zero before?)
      return false;
    }
    if (rawPublicKey[0] == 0 && rawPublicKey[1] == 0) {
      // empty keys aren't valid, if attempting to clear, use remove
      return false;
    }
    if (reservedAccountIds[originDomain][credentialId] != address(0)) {
      // this key is already reserved for another user
      return false;
    }

    lowerKeyHalf[originDomain][credentialId][msg.sender] = rawPublicKey[0];
    upperKeyHalf[originDomain][credentialId][msg.sender] = rawPublicKey[1];
    keyExistsOnDomain[originDomain][credentialId] = msg.sender;
    domainAccountKeys[originDomain][msg.sender].push(credentialId);

    emit PasskeyCreated(msg.sender, originDomain, credentialId);

    return true;
  }

  /// @notice Updates the account mapping for a given account ID during recovery.
  /// @dev Can only be called by the account's validators.
  /// @param credentialId unique public identifier for the key
  /// @param originDomain the domain this associated with
  /// @param accountAddress The address of the account to update the mapping for.
  function reserveCredentialId(
    bytes memory credentialId,
    string memory originDomain,
    address accountAddress
  ) external onlyAccountValidator(accountAddress) {
    require(
      keyExistsOnDomain[originDomain][credentialId] == address(0),
      AccountAlreadyRegistered(originDomain, credentialId)
    );
    require(
      reservedAccountIds[originDomain][credentialId] == address(0),
      AccountAlreadyRegistered(originDomain, credentialId)
    );

    reservedAccountIds[originDomain][credentialId] = accountAddress;
  }

  /// @notice Updates the account mapping for a given account ID during recovery.
  /// @dev Can only be called by the account's validators.
  /// @param credentialId unique public identifier for the key
  /// @param originDomain the domain this associated with
  /// @param accountAddress The address of the account to update the mapping for.
  function releaseCredentialIdReservation(
    bytes memory credentialId,
    string memory originDomain,
    address accountAddress
  ) external onlyAccountValidator(accountAddress) {
    require(
      reservedAccountIds[originDomain][credentialId] == accountAddress,
      AccountAlreadyRegistered(originDomain, credentialId)
    );

    reservedAccountIds[originDomain][credentialId] = address(0);
  }

  /// @notice Validates a WebAuthn signature
  /// @param signedHash The hash of the signed message
  /// @param signature The signature to validate
  /// @return true if the signature is valid
  function validateSignature(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    return webAuthVerify(signedHash, signature);
  }

  /// @notice Validates a transaction signed with a passkey
  /// @dev Does not validate the transaction signature field, which is expected to be different due to the modular format
  /// @param signedHash The hash of the signed transaction
  /// @param signature The signature to validate
  /// @return true if the signature is valid
  function validateTransaction(
    bytes32 signedHash,
    bytes calldata signature,
    Transaction calldata
  ) external view returns (bool) {
    return webAuthVerify(signedHash, signature);
  }

  /// @notice Validates a WebAuthn signature
  /// @dev Performs r & s range validation to prevent signature malleability
  /// @dev Checks passkey authenticator data flags (valid number of credentials)
  /// @dev Requires that the transaction signature hash was the signed challenge
  /// @dev Verifies that the signature was performed by a 'get' request
  /// @param transactionHash The hash of the signed message
  /// @param fatSignature The signature to validate (authenticator data, client data, [r, s])
  /// @return true if the signature is valid
  function webAuthVerify(bytes32 transactionHash, bytes memory fatSignature) internal view returns (bool) {
    (
      bytes memory authenticatorData,
      string memory clientDataJSON,
      bytes32[2] memory rs,
      bytes memory credentialId
    ) = _decodeFatSignature(fatSignature);

    // prevent signature replay https://yondon.blog/2019/01/01/how-not-to-use-ecdsa/
    if (rs[0] <= 0 || rs[0] > HIGH_R_MAX || rs[1] <= 0 || rs[1] > LOW_S_MAX) {
      return false;
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/Authenticator_data#attestedcredentialdata
    if (authenticatorData[32] & AUTH_DATA_MASK != AUTH_DATA_MASK) {
      return false;
    }

    // parse out the required fields (type, challenge, crossOrigin): https://goo.gl/yabPex
    JSONParserLib.Item memory root = JSONParserLib.parse(clientDataJSON);
    // challenge should contain the transaction hash, ensuring that the transaction is signed
    string memory challenge = root.at('"challenge"').value().decodeString();
    bytes memory challengeData = Base64.decode(challenge);
    if (challengeData.length != 32) {
      return false; // wrong hash size
    }
    if (bytes32(challengeData) != transactionHash) {
      return false;
    }

    // type ensures the signature was created from a validation request
    string memory type_ = root.at('"type"').value().decodeString();
    if (!Strings.equal("webauthn.get", type_)) {
      return false;
    }

    // the origin determines which key to validate against
    // as passkeys are linked to domains, so the storage mapping reflects that
    string memory origin = root.at('"origin"').value().decodeString();
    bytes32[2] memory pubkey;
    pubkey[0] = lowerKeyHalf[origin][credentialId][msg.sender];
    pubkey[1] = upperKeyHalf[origin][credentialId][msg.sender];
    // This really only validates the origin is set
    if (uint256(pubkey[0]) == 0 || uint256(pubkey[1]) == 0) {
      return false;
    }

    // cross-origin validation is optional, but explicitly not supported.
    // cross-origin requests would be from embedding the auth request
    // from another domain. The current SSO setup uses a pop-up instead of
    // an i-frame, so we're rejecting these until the implemention supports it
    JSONParserLib.Item memory crossOriginItem = root.at('"crossOrigin"');
    if (!crossOriginItem.isUndefined()) {
      string memory crossOrigin = crossOriginItem.value();
      if (!Strings.equal("false", crossOrigin)) {
        return false;
      }
    }

    bytes32 message = _createMessage(authenticatorData, bytes(clientDataJSON));
    return callVerifier(P256_VERIFIER, message, rs, pubkey);
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return
      interfaceId == type(IERC165).interfaceId ||
      interfaceId == type(IModuleValidator).interfaceId ||
      interfaceId == type(IModule).interfaceId;
  }

  function _createMessage(
    bytes memory authenticatorData,
    bytes memory clientData
  ) private pure returns (bytes32 message) {
    bytes32 clientDataHash = sha256(clientData);
    message = sha256(bytes.concat(authenticatorData, clientDataHash));
  }

  function _decodeFatSignature(
    bytes memory fatSignature
  )
    private
    pure
    returns (
      bytes memory authenticatorData,
      string memory clientDataSuffix,
      bytes32[2] memory rs,
      bytes memory credentialId
    )
  {
    (authenticatorData, clientDataSuffix, rs, credentialId) = abi.decode(
      fatSignature,
      (bytes, string, bytes32[2], bytes)
    );
  }

  /// @notice Verifies a message using the P256 curve.
  /// @dev Useful for testing the P256 precompile
  /// @param message The sha256 hash of the authenticator hash and hashed client data
  /// @param rs The signature to validate (r, s) from the signed message
  /// @param pubKey The public key to validate the signature against (x, y)
  /// @return valid true if the signature is valid
  function rawVerify(
    bytes32 message,
    bytes32[2] calldata rs,
    bytes32[2] calldata pubKey
  ) internal view returns (bool valid) {
    valid = callVerifier(P256_VERIFIER, message, rs, pubKey);
  }

  function getDomainAccountKeys(
    string calldata originDomain,
    address accountAddress
  ) external view returns (bytes[] memory) {
    return domainAccountKeys[originDomain][accountAddress];
  }

  /// @notice Modifier that checks if the caller is a validator for the given account.
  /// @param _accountAddress The address of the account to check the validator for.
  modifier onlyAccountValidator(address _accountAddress) {
    require(ISsoAccount(_accountAddress).isModuleValidator(msg.sender), "Unauthorized validator");
    _;
  }
}
