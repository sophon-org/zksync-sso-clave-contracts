// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IInitable } from "../interfaces/IInitable.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IModule is IInitable, IERC165 {
  /**
   * @dev Returns boolean value if module is a certain type
   * @param moduleTypeId the module type ID according the ERC-7579 spec
   *
   * MUST return true if the module is of the given type and false otherwise
   */
  function isModuleType(uint256 moduleTypeId) external view returns (bool);

  /**
   * @dev Returns if the module was already initialized for a provided smartaccount
   */
  function isInitialized(address smartAccount) external view returns (bool);
}
