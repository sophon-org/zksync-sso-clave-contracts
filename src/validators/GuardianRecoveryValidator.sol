// SPDX-License-Identifier: MIT
import { IGuardianRecoveryValidator } from "../interfaces/IGuardianRecoveryValidator.sol";
import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";

contract GuardianRecoveryValidator is IGuardianRecoveryValidator {
  struct Guardian {
    address addr;
    bool isReady;
  }

  mapping(address account => Guardian[]) accountGuardians;

  function init(bytes calldata initData) external {}

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

    revert("Guardian not found.");
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

    revert("Guardian was not proposed for given account.");
  }

  // This method has to start the recovery.
  // It's called by the sso account.
  function initRecovery(bytes memory passkey) external {}

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
