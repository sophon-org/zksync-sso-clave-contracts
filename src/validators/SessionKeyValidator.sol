// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { ISessionKeyValidator } from "../interfaces/ISessionKeyValidator.sol";
import { IModule } from "../interfaces/IModule.sol";
import { IValidatorManager } from "../interfaces/IValidatorManager.sol";
import { SessionLib } from "../libraries/SessionLib.sol";
import { Errors } from "../libraries/Errors.sol";
import { SsoUtils } from "../helpers/SsoUtils.sol";
import { TimestampAsserterLocator } from "../helpers/TimestampAsserterLocator.sol";
import { ISsoAccount } from "../interfaces/ISsoAccount.sol";

/// @title SessionKeyValidator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @notice This contract is used to manage sessions for a smart account.
contract SessionKeyValidator is ISessionKeyValidator {
  using SessionLib for SessionLib.SessionStorage;

  mapping(address signer => bytes32 sessionHash) public sessionSigner;
  mapping(bytes32 sessionHash => SessionLib.SessionStorage sessionState) internal sessions;

  /// @notice Get the session state for an account
  /// @param account The account to fetch the session state for
  /// @param spec The session specification to get the state of
  /// @return The session state: status, remaining fee limit, transfer limits, call value and call parameter limits
  function sessionState(
    address account,
    SessionLib.SessionSpec calldata spec
  ) external view virtual returns (SessionLib.SessionState memory) {
    return sessions[keccak256(abi.encode(spec))].getState(account, spec);
  }

  /// @notice Get the status of a session
  /// @param account The account to fetch the session status for
  /// @param sessionHash The session hash to fetch the status of
  /// @return The status of the session: NotInitialized, Active or Closed
  function sessionStatus(address account, bytes32 sessionHash) external view virtual returns (SessionLib.Status) {
    return sessions[sessionHash].status[account];
  }

  /// @notice Runs on module install
  /// @param data ABI-encoded session specification to immediately create a session, or empty if not needed
  function onInstall(bytes calldata data) external virtual {
    if (data.length > 0) {
      // This always either succeeds with `true` or reverts within,
      // so we don't need to check the return value.
      _addValidationKey(data);
    }
  }

  /// @notice Runs on module uninstall
  /// @param data ABI-encoded array of session hashes to revoke
  /// @dev Revokes provided sessions before uninstalling,
  /// reverts if any session is still active after that.
  /// @notice Only provided sessions will be revoked, not necessarily all active sessions.
  /// If any active session is unrevoked on uninstall, it will become active again
  /// if the module is reinstalled, unless the session expires.
  function onUninstall(bytes calldata data) external virtual {
    // Revoke keys before uninstalling
    bytes32[] memory sessionHashes = abi.decode(data, (bytes32[]));
    for (uint256 i = 0; i < sessionHashes.length; i++) {
      revokeKey(sessionHashes[i]);
    }
  }

  /// @notice This module should not be used to validate signatures (including EIP-1271),
  /// as a signature by itself does not have enough information to validate it against a session.
  /// @return false
  function validateSignature(bytes32, bytes memory) external pure returns (bool) {
    return false;
  }

  /// @notice Checks for banned call policies.
  /// @dev Banned policies are:
  /// - all calls to account's validators/hooks, e.g.
  ///   + createSession
  ///   + addValidationKey
  ///   + addGuardian
  /// - all calls to the account itself, e.g.
  ///   + addModuleValidator
  ///   + addHook
  ///   + batchCall
  /// @dev can be extended by derived contracts.
  /// @param target The target address of the call
  /// @param _selector The function selector of the call; currently unused
  /// @return true if the call is banned, false otherwise
  function isBannedCall(address target, bytes4 _selector) internal view virtual returns (bool) {
    return
      target == address(this) || // this line is technically unnecessary
      ISsoAccount(msg.sender).isModuleValidator(target) ||
      ISsoAccount(msg.sender).isHook(target) ||
      target == address(msg.sender);
  }

  /// @notice Create a new session for an account
  /// @param sessionSpec The session specification to create a session with
  function createSession(SessionLib.SessionSpec memory sessionSpec) public virtual {
    bytes32 sessionHash = keccak256(abi.encode(sessionSpec));
    if (!isInitialized(msg.sender)) {
      revert Errors.NOT_FROM_INITIALIZED_ACCOUNT(msg.sender);
    }
    if (sessionSpec.signer == address(0)) {
      revert Errors.SESSION_ZERO_SIGNER();
    }
    // Avoid using same session key for multiple sessions, contract-wide
    if (sessionSigner[sessionSpec.signer] != bytes32(0)) {
      revert Errors.SESSION_SIGNER_USED(sessionSpec.signer);
    }
    if (sessionSpec.feeLimit.limitType == SessionLib.LimitType.Unlimited) {
      revert Errors.SESSION_UNLIMITED_FEES();
    }
    if (sessions[sessionHash].status[msg.sender] != SessionLib.Status.NotInitialized) {
      revert Errors.SESSION_ALREADY_EXISTS(sessionHash);
    }
    // Sessions should expire in no less than 60 seconds.
    if (sessionSpec.expiresAt <= block.timestamp + 60) {
      revert Errors.SESSION_EXPIRES_TOO_SOON(sessionSpec.expiresAt);
    }

    uint256 totalCallPolicies = sessionSpec.callPolicies.length;
    for (uint256 i = 0; i < totalCallPolicies; i++) {
      if (isBannedCall(sessionSpec.callPolicies[i].target, sessionSpec.callPolicies[i].selector)) {
        revert Errors.SESSION_CALL_POLICY_BANNED(
          sessionSpec.callPolicies[i].target,
          sessionSpec.callPolicies[i].selector
        );
      }
    }

    sessions[sessionHash].status[msg.sender] = SessionLib.Status.Active;
    sessionSigner[sessionSpec.signer] = sessionHash;
    emit SessionCreated(msg.sender, sessionHash, sessionSpec);
  }

  /// @notice creates a new session for an account, called by onInstall
  /// @param sessionData ABI-encoded session specification
  function _addValidationKey(bytes calldata sessionData) internal virtual returns (bool) {
    SessionLib.SessionSpec memory sessionSpec = abi.decode(sessionData, (SessionLib.SessionSpec));
    createSession(sessionSpec);
    return true;
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) external pure virtual returns (bool) {
    return
      interfaceId == type(IERC165).interfaceId ||
      interfaceId == type(IModuleValidator).interfaceId ||
      interfaceId == type(IModule).interfaceId;
  }

  /// @notice Revoke a session for an account
  /// @param sessionHash The hash of a session to revoke
  /// @dev Decreases the session counter for the account
  function revokeKey(bytes32 sessionHash) public virtual {
    if (sessions[sessionHash].status[msg.sender] != SessionLib.Status.Active) {
      revert Errors.SESSION_NOT_ACTIVE();
    }
    sessions[sessionHash].status[msg.sender] = SessionLib.Status.Closed;
    emit SessionRevoked(msg.sender, sessionHash);
  }

  /// @notice Revoke multiple sessions for an account
  /// @param sessionHashes An array of session hashes to revoke
  function revokeKeys(bytes32[] calldata sessionHashes) external virtual {
    for (uint256 i = 0; i < sessionHashes.length; i++) {
      revokeKey(sessionHashes[i]);
    }
  }

  /// @notice Check if the validator is registered for the smart account
  /// @param smartAccount The smart account to check
  /// @return true if validator is registered for the account, false otherwise
  function isInitialized(address smartAccount) public view virtual returns (bool) {
    return IValidatorManager(smartAccount).isModuleValidator(address(this));
  }

  /// @notice Validate a session transaction for an account
  /// @param signedHash The hash of the transaction
  /// @param transaction The transaction to validate
  /// @return true if the transaction is valid
  /// @dev Session spec and period IDs must be provided as validator data
  function validateTransaction(bytes32 signedHash, Transaction calldata transaction) public virtual returns (bool) {
    (bytes memory transactionSignature, address _validator, bytes memory validatorData) = SsoUtils.decodeSignature(
      transaction.signature
    );
    (SessionLib.SessionSpec memory spec, uint64[] memory periodIds) = abi.decode(
      validatorData, // this is passed by the signature builder
      (SessionLib.SessionSpec, uint64[])
    );
    if (spec.signer == address(0)) {
      revert Errors.SESSION_ZERO_SIGNER();
    }
    bytes32 sessionHash = keccak256(abi.encode(spec));
    // this generally throws instead of returning false
    sessions[sessionHash].validate(transaction, spec, periodIds);
    (address recoveredAddress, ECDSA.RecoverError recoverError) = ECDSA.tryRecover(signedHash, transactionSignature);
    if (recoverError != ECDSA.RecoverError.NoError || recoveredAddress == address(0)) {
      return false;
    }
    if (recoveredAddress != spec.signer) {
      revert Errors.SESSION_INVALID_SIGNER(recoveredAddress, spec.signer);
    }
    // This check is separate and performed last to prevent gas estimation failures
    sessions[sessionHash].validateFeeLimit(transaction, spec, periodIds[0]);
    return true;
  }
}
