// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IAccount} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IAccount.sol";

import {IERC1271Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC1271Upgradeable.sol";
import {IERC777Recipient} from "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import {IHookManager} from "./IHookManager.sol";
import {IModuleManager} from "./IModuleManager.sol";
import {IOwnerManager} from "./IOwnerManager.sol";
import {IUpgradeManager} from "./IUpgradeManager.sol";
import {IValidatorManager} from "./IValidatorManager.sol";

/**
 * @title IClaveAccount
 * @notice Interface for the Clave contract
 * @dev Implementations of this interface are contract that can be used as a Clave
 */
interface IClaveAccount is
    IERC1271Upgradeable,
    IERC721Receiver,
    IERC1155Receiver,
    IHookManager,
    IModuleManager,
    IOwnerManager,
    IValidatorManager,
    IUpgradeManager,
    IAccount
{
    event FeePaid();

    function initialize(
        address[] calldata k1Owners,
        bytes[] calldata r1Owners,
        address[] calldata validators,
        address[] calldata modules,
        bytes[] calldata initData
    ) external;
}
