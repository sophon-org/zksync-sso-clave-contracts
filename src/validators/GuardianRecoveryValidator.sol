// SPDX-License-Identifier: MIT
import { IGuardianRecoveryValidator } from "../interfaces/IGuardianRecoveryValidator.sol";

contract GuardianRecoveryValidator is IGuardianRecoveryValidator {
  function init(bytes calldata key) external {}

  function disable() external {}

  function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function proposeValidationKey(address externalAccount) external;

  function removeValidationKey(address externalAccount) external;

  function initRecovery(bytes memory passkey) external;

  // IModuleValidator
  function addValidationKey(bytes memory key) external returns (bool);

  // IModuleValidator
  function validateTransaction(
    bytes32 signedHash,
    bytes memory signature,
    Transaction calldata transaction
  ) external returns (bool);

  // IModuleValidator
  function validateSignature(bytes32 signedHash, bytes memory signature) external view returns (bool);
}
