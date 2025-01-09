// SPDX-License-Identifier: MIT
import { IModuleValidator } from "./IModuleValidator.sol";

interface IGuardianRecoveryValidator is IModuleValidator {
  struct ExternalAccountSpec {
    address externalAccount;
    bytes signature;
  }

  function proposeValidationKey(address externalAccount) external {
    // The `proposeValidationKey` method handles the initial registration of external accounts by:
    //   1. Taking an external account address and store it as pending guardian
    //   2. Enable `addValidationKey` to confirm this account
  }

  function removeValidationKey(address externalAccount) external {
    // This method handles the removal of external accounts by:
    //   1. Accepting an address as input
    //   2. Removing the account from the list of guardians
  }

  function initRecovery(bytes memory passkey) external {
    // Stores the new passkey with the timestamp associated with the caller
  }

  // IModuleValidator
  function addValidationKey(bytes memory key) external returns (bool) {
    // The `addValidationKey` method handles the registration of external accounts by:
    //   1. Taking a specification that includes the external account address and its signature (`ExternalAccountSpec` or similar)
    //   2. Verifying that the external account was proposed as guardian
    //   3. Verifying that the signature proves ownership of the external account
    //   4. Recording the validated external account for future transaction validation
    return false;
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
    //   2. Verifies the transaction is signed by a registered external account
    // If the user has a recovery in progress then:
    //   1. The method will verify calls to `WebAuthnModule`
    //   2. Checks if the transaction is attempting to modify passkeys
    //   3. Verify the new passkey is the one stored in `initRecovery`
    //   4. Allows anyone to call this method, as the recovery was already verified in `initRecovery`
    //   5. Verifies that the required timelock period has passed since `initRecovery` was called
    return false;
  }

  // This module is not meant to be used to validate signatures
  function validateSignature(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    return false;
  }
}
