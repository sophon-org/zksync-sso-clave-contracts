// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IGuardianRecoveryValidator } from "../interfaces/IGuardianRecoveryValidator.sol";
import { WebAuthValidator } from "./WebAuthValidator.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { SignatureDecoder } from "../libraries/SignatureDecoder.sol";

contract GuardianRecoveryValidator is IGuardianRecoveryValidator {
  struct Guardian {
    address addr;
    bool isReady;
  }
  struct RecoveryRequest {
    bytes passkey;
    uint256 timestamp;
  }

  error GuardianNotFound(address guardian);
  error GuardianNotProposed(address guardian);

  event RecoveryInitiated();

  uint256 constant REQUEST_VALIDITY_TIME = 72 * 60 * 60; // 72 hours
  uint256 constant REQUEST_DELAY_TIME = 24 * 60 * 60; // 24 hours

  mapping(address account => Guardian[]) public accountGuardians;
  mapping(address account => mapping(address validator => RecoveryRequest)) public pendingRecoveryData;

  address public webAuthValidator;

  constructor(address _webAuthValidator) {
    webAuthValidator = _webAuthValidator;
  }

  function init(bytes calldata initData) external {
    address[] memory initialGuardians = abi.decode(initData, (address[]));
    Guardian[] storage guardians = accountGuardians[msg.sender];

    for (uint256 i = 0; i < initialGuardians.length; i++) {
      guardians.push(Guardian(initialGuardians[i], true)); // Make initial guardians active instanenously
    }
  }

  // When this module is disabled in an account all the
  // data associated with that account is freed.
  function disable() external {
    Guardian[] storage guardians = accountGuardians[msg.sender];

    delete accountGuardians[msg.sender];
  }

  // The `proposeValidationKey` method handles the initial registration of external accounts by:
  //   1. Taking an external account address and store it as pending guardian
  //   2. Enable `addValidationKey` to confirm this account
  function proposeValidationKey(address newGuardian) external {
    Guardian[] storage guardians = accountGuardians[msg.sender];

    // If the guardian exist this method stops
    for (uint256 i = 0; i < guardians.length; i++) {
      if (guardians[i].addr == newGuardian) {
        return;
      }
    }

    guardians.push(Guardian(newGuardian, false));
  }

  // This method handles the removal of external accounts by:
  //   1. Accepting an address as input
  //   2. Removing the account from the list of guardians
  function removeValidationKey(address guardianToRemove) external {
    Guardian[] storage guardians = accountGuardians[msg.sender];

    // Searchs guardian with given address
    for (uint256 i = 0; i < guardians.length; i++) {
      if (guardians[i].addr == guardianToRemove) {
        // If found last guardian is moved to current position, and then
        // last element is removed from array.
        guardians[i] = guardians[guardians.length - 1];
        guardians.pop();
        return;
      }
    }

    revert GuardianNotFound(guardianToRemove);
  }

  // IModuleValidator
  // This is called by the guardian.
  function addValidationKey(bytes memory key) external returns (bool) {
    // Interprets argument as address;
    address accountToGuard = abi.decode(key, (address));
    Guardian[] storage guardians = accountGuardians[accountToGuard];

    // Searchs if the caller is in the list of guardians.
    // If guardian found is set to true.
    for (uint256 i = 0; i < guardians.length; i++) {
      if (guardians[i].addr == msg.sender) {
        // We return true if the guardian was not confirmed before.
        bool retValue = !guardians[i].isReady;
        guardians[i].isReady = true;
        return retValue;
      }
    }

    revert GuardianNotProposed(msg.sender);
  }

  // This method has to start the recovery.
  // It's called by the sso account.
  function initRecovery(bytes memory passkey) external {
    pendingRecoveryData[msg.sender][webAuthValidator] = RecoveryRequest(passkey, block.timestamp);
    emit RecoveryInitiated();
  }

  // IModuleValidator
  function validateTransaction(
    bytes32 signedHash,
    bytes memory signature,
    Transaction calldata transaction
  ) external returns (bool) {
    // The `validateTransaction` method will perform different validations according to the stage of the recovery flow.
    // If the user hasn’t initiated a recovery yet then:
    //   1. The method will allow calls only to `initRecovery`
    //   2. Verifies the transaction is signed by the guardian of the sso account.
    // If the user has a recovery in progress then:
    //   1. The method will verify calls to `WebAuthnModule`
    //   2. Checks if the transaction is attempting to modify passkeys
    //   3. Verify the new passkey is the one stored in `initRecovery`
    //   4. Allows anyone to call this method, as the recovery was already verified in `initRecovery`
    //   5. Verifies that the required timelock period has passed since `initRecovery` was called
    (bytes memory transactionSignature, address _validator, bytes memory validatorData) = SignatureDecoder
      .decodeSignature(transaction.signature);

    require(transaction.data.length >= 4, "Only function calls are supported");
    bytes4 selector = bytes4(transaction.data[:4]);

    require(transaction.to <= type(uint160).max, "Overflow");
    address target = address(uint160(transaction.to));

    if (target == address(this)) {
      require(selector == this.initRecovery.selector, "Unsupported function call");

      (address recoveredAddress, ECDSA.RecoverError recoverError) = ECDSA.tryRecover(signedHash, transactionSignature);
      if (recoverError != ECDSA.RecoverError.NoError || recoveredAddress == address(0)) {
        return false;
      }
      for (uint256 i = 0; i < accountGuardians[msg.sender].length; i++) {
        if (accountGuardians[msg.sender][i].addr == recoveredAddress && accountGuardians[msg.sender][i].isReady)
          return true;
      }
    } else if (target == address(webAuthValidator)) {
      require(selector == WebAuthValidator.addValidationKey.selector, "Unsupported function call");
      bytes memory validationKeyData = abi.decode(transaction.data[4:], (bytes));

      require(
        pendingRecoveryData[msg.sender][target].passkey.length == validationKeyData.length &&
          keccak256(pendingRecoveryData[msg.sender][target].passkey) == keccak256(validationKeyData),
        "New Passkey not matched with recent request"
      );

      uint256 timePassedSinceRequest = block.timestamp - pendingRecoveryData[msg.sender][target].timestamp;
      require(timePassedSinceRequest > REQUEST_DELAY_TIME, "Cooldown period not passed");
      require(timePassedSinceRequest < REQUEST_VALIDITY_TIME, "Request not valid anymore");

      delete pendingRecoveryData[msg.sender][target];

      return true;
    }

    return false;
  }

  // This module is not meant to be used to validate signatures
  function validateSignature(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    return false;
  }

  function supportsInterface(bytes4 interfaceId) external view returns (bool) {
    return interfaceId == type(IERC165).interfaceId || interfaceId == type(IModuleValidator).interfaceId;
  }

  function guardiansFor(address addr) public view returns (Guardian[] memory) {
    return accountGuardians[addr];
  }
}
