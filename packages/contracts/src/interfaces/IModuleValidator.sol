// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/**
 * @title Modular validator interface for native AA
 * @dev Add signature to module or validate existing signatures for acccount
 */
interface IModuleValidator {
  function isValidSignature(bytes32 signedHash, bytes memory signature) external view returns (bytes4);

  function addValidationKey(bytes memory key) external returns (bool);
}
