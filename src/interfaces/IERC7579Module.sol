// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

uint256 constant VALIDATION_SUCCESS = 0;
uint256 constant VALIDATION_FAILED = 1;

uint256 constant MODULE_TYPE_VALIDATOR = 1;
uint256 constant MODULE_TYPE_EXECUTOR = 2;
uint256 constant MODULE_TYPE_FALLBACK = 3;
uint256 constant MODULE_TYPE_HOOK = 4;

interface IERC7579Module {
  error AlreadyInitialized(address smartAccount);
  error NotInitialized(address smartAccount);

  /**
   * @dev This function is called by the smart account during installation of the module
   * @param data arbitrary data that may be required on the module during `onInstall`
   * initialization
   *
   * MUST revert on error (i.e. if module is already enabled)
   */
  function onInstall(bytes calldata data) external;

  /**
   * @dev This function is called by the smart account during uninstallation of the module
   * @param data arbitrary data that may be required on the module during `onUninstall`
   * de-initialization
   *
   * MUST revert on error
   */
  function onUninstall(bytes calldata data) external;

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

interface IExecutor is IERC7579Module {}

interface IHook is IERC7579Module {
  function preCheck(
    address msgSender,
    uint256 msgValue,
    bytes calldata msgData
  ) external returns (bytes memory hookData);

  function postCheck(bytes calldata hookData) external;
}

interface IFallback is IERC7579Module {}
