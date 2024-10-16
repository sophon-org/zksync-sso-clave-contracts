// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IERC7579Module.sol";

import { IModule } from "../interfaces/IModule.sol";
import { IValidationHook, IExecutionHook } from "../interfaces/IHook.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";

import { Transaction } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { IHook } from "../interfaces/IERC7579Module.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "hardhat/console.sol";

library SessionLib {
  struct SessionPolicy {
    // (target, selector) => function policy
    mapping(address => mapping(bytes4 => FunctionPolicy)) policy;
    // timestamp when this session expires
    uint256 expiry;
    // to close the session early, flip this flag
    bool isOpen;
    LimitUsage feeLimit;
  }

  struct FunctionPolicy {
    // this flag is needed, as otherwise, an empty FunctionPolicy (default mapping entry)
    // would mean no constraints
    bool isAllowed;
    uint256 maxValuePerUse;
    LimitUsage valueUsage;
    Constraint[] paramConstraints;
  }

  struct Constraint {
    Condition condition;
    uint64 offset;
    bytes32 refValue;
    // Lifetime cumulative limit (optional)
    LimitUsage usage;
    // Cumulative limit per time period (optional)
    Allowance allowance;
  }

  struct LimitUsage {
    bool isLimited;
    uint256 limit;
    uint256 used;
  }

  struct Allowance {
    bool isLimited;
    uint256 timePeriod;
    uint256 limit;
    // period => used that period
    mapping(uint256 => uint256) used;
  }

  enum Condition {
    UNCONSTRAINED,
    EQUAL,
    GREATER_THAN,
    LESS_THAN,
    GREATER_THAN_OR_EQUAL,
    LESS_THAN_OR_EQUAL,
    NOT_EQUAL
  }

  struct NewSession {
    address signer;
    uint256 expiry;
    uint256 feeLimit;
    NewFunctionPolicy[] policies;
  }

  struct NewFunctionPolicy {
    bytes4 selector;
    address target;
    uint256 maxValuePerUse;
    bool isValueLimited;
    uint256 valueLimit;
    NewConstraint[] constraints;
  }

  struct NewConstraint {
    SessionLib.Condition condition;
    uint64 offset;
    bytes32 refValue;
    bool isUsageLimited;
    uint256 usageLimit;
    bool isAllowanceLimited;
    uint256 timePeriod;
    uint256 allowanceLimit;
  }

  function validate(SessionPolicy storage policy, Transaction calldata transaction) internal returns (bool) {
    if (!policy.isOpen) {
      return false;
    }

    // TODO
    // if (block.timestamp > policy.expiry) {
    //   policy.isOpen = false;
    //   return false;
    // }

    // TODO: do this in a postCheck during execution to get precise gas usage?
    uint256 fee = transaction.maxFeePerGas * transaction.gasLimit;
    if (policy.feeLimit.used + fee > policy.feeLimit.limit) {
      return false;
    }
    policy.feeLimit.used += fee;

    bytes4 selector = bytes4(transaction.data[:4]);
    address target = address(uint160(transaction.to));
    FunctionPolicy storage functionPolicy = policy.policy[target][selector];
    if (!functionPolicy.isAllowed) {
      return false;
    }
    if (transaction.value > functionPolicy.maxValuePerUse) {
      return false;
    }
    if (functionPolicy.valueUsage.isLimited) {
      if (functionPolicy.valueUsage.used + transaction.value > functionPolicy.valueUsage.limit) {
        return false;
      }
      functionPolicy.valueUsage.used += transaction.value;
    }

    for (uint256 i = 0; i < functionPolicy.paramConstraints.length; i++) {
      if (!checkAndUpdate(functionPolicy.paramConstraints[i], transaction.data)) {
        return false;
      }
    }

    return true;
  }

  function checkAndUpdate(Constraint storage constraint, bytes calldata data) internal returns (bool) {
    uint256 offset = 4 + constraint.offset;
    bytes32 param = bytes32(data[offset:offset + 32]);
    Condition condition = constraint.condition;
    bytes32 refValue = constraint.refValue;

    // CHECK Condition
    if (condition == Condition.EQUAL && param != refValue) {
        return false;
    } else if (condition == Condition.GREATER_THAN && param <= refValue) {
        return false;
    } else if (condition == Condition.LESS_THAN && param >= refValue) {
        return false;
    } else if (condition == Condition.GREATER_THAN_OR_EQUAL && param < refValue) {
        return false;
    } else if (condition == Condition.LESS_THAN_OR_EQUAL && param > refValue) {
        return false;
    } else if (condition == Condition.NOT_EQUAL && param == refValue) {
        return false;
    }

    // CHECK lifetime limit
    if (constraint.usage.isLimited) {
      uint256 newUsed = constraint.usage.used + uint256(param);
      if (newUsed > constraint.usage.limit) {
        return false;
      }
      constraint.usage.used = newUsed;
    }

    // TODO time period limit
    // if (constraint.allowance.isLimited) {
    //   uint256 period = block.timestamp / constraint.allowance.timePeriod;
    //   uint256 newUsed = constraint.allowance.used[period] + uint256(param);
    //   if (newUsed > constraint.allowance.limit) {
    //     return false;
    //   }
    //   constraint.allowance.used[period] = newUsed;
    // }

    return true;
  }

  function validateTimestamps(SessionPolicy storage policy, Transaction calldata transaction) internal returns (bool) {
    if (block.timestamp > policy.expiry) {
      policy.isOpen = false;
      return false;
    }

    bytes4 selector = bytes4(transaction.data[:4]);
    address target = address(uint160(transaction.to));
    FunctionPolicy storage functionPolicy = policy.policy[target][selector];

    for (uint256 i = 0; i < functionPolicy.paramConstraints.length; i++) {
      Constraint storage constraint = functionPolicy.paramConstraints[i];
      uint256 offset = 4 + constraint.offset;
      bytes32 param = bytes32(transaction.data[offset:offset + 32]);
      if (constraint.allowance.isLimited) {
        uint256 period = block.timestamp / constraint.allowance.timePeriod;
        uint256 newUsed = constraint.allowance.used[period] + uint256(param);
        if (newUsed > constraint.allowance.limit) {
          return false;
        }
        constraint.allowance.used[period] = newUsed;
      }
    }
  }

  function fill(SessionPolicy storage session, NewSession memory newSession) internal {
    session.isOpen = true;
    session.expiry = newSession.expiry;
    for (uint256 i = 0; i < newSession.policies.length; i++) {
      NewFunctionPolicy memory newFunctionPolicy = newSession.policies[i];
      FunctionPolicy storage functionPolicy = session.policy[newFunctionPolicy.target][newFunctionPolicy.selector];
      functionPolicy.isAllowed = true;
      functionPolicy.maxValuePerUse = newFunctionPolicy.maxValuePerUse;
      if (newFunctionPolicy.isValueLimited) {
        functionPolicy.valueUsage.isLimited = true;
        functionPolicy.valueUsage.limit = newFunctionPolicy.valueLimit;
      }
      for (uint256 j = 0; j < newFunctionPolicy.constraints.length; j++) {
        NewConstraint memory newConstraint = newFunctionPolicy.constraints[j];
        Constraint storage constraint = functionPolicy.paramConstraints[j];
        constraint.condition = newConstraint.condition;
        constraint.offset = newConstraint.offset;
        constraint.refValue = newConstraint.refValue;
        if (newConstraint.isUsageLimited) {
          constraint.usage.isLimited = true;
          constraint.usage.limit = newConstraint.usageLimit;
        }
        if (newConstraint.isAllowanceLimited) {
          constraint.allowance.isLimited = true;
          constraint.allowance.timePeriod = newConstraint.timePeriod;
          constraint.allowance.limit = newConstraint.allowanceLimit;
        }
      }
    }

  }
}

contract SessionKeyValidator is IHook, IValidationHook, IExecutionHook, IModuleValidator {
  using SessionLib for SessionLib.SessionPolicy;

  bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

  struct AccountSessions {
    // id => session
    mapping(uint256 => SessionLib.SessionPolicy) sessionsById;
    // signer => id
    mapping(address => uint256) sessionsBySigner;
    // should start with 1
    uint256 nextSessionId;
  }

  mapping(address => AccountSessions) public sessions;

  function handleValidation(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    // this only validates that the session key is linked to the account, not the spend limit
    return isValidSignature(signedHash, signature) == EIP1271_SUCCESS_RETURN_VALUE;
  }

  // TODO what bool does it return
  function addValidationKey(bytes memory sessionData) external returns (bool) {
    if (sessionData.length == 0) {
      return false;
    }
    SessionLib.NewSession memory newSession = abi.decode(sessionData, (SessionLib.NewSession));
    uint256 sessionId = sessions[msg.sender].nextSessionId++;
    sessions[msg.sender].sessionsBySigner[newSession.signer] = sessionId;
    SessionLib.SessionPolicy storage session = sessions[msg.sender].sessionsById[sessionId];
    session.fill(newSession);
    return true;
  }

  function init(bytes calldata data) external {
    _install(data);
  }

  /* array of token spend limit configurations (sane defaults)
   * @param data TokenConfig[]
   */
  function onInstall(bytes calldata data) external override {
    _install(data);
  }

  function _install(bytes calldata data) internal {
    // TODO maybe add ability to add session keys here too
    sessions[msg.sender].nextSessionId = 1;
  }

  /* Remove all the spending limits for the message sender
   * @param data (unused, but needed to satisfy interfaces)
   */
  function onUninstall(bytes calldata) external override {
    // TODO: if uninstalled and then installed again, will behave incorrectly
    // _clearSender();
  }

  function disable() external {
    // _clearSender();
  }

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    // found by example
    return interfaceId == 0x01ffc9a7 || interfaceId == 0xffffffff;
  }

  function revokeKey(address sessionKey) external {
    sessions[msg.sender].sessionsBySigner[sessionKey] = 0;
  }

  /*
   * If there are any spend limits configured
   * @param smartAccount The smart account to check
   * @return true if spend limits are configured initialized, false otherwise
   */
  function isInitialized(address smartAccount) external view returns (bool) {
    return sessions[smartAccount].nextSessionId > 0;
  }

  /*
   * Currently doing 1271 validation, but might update the interface to match the zksync account validation
   */
  function isValidSignature(bytes32 hash, bytes memory signature) public view returns (bytes4 magic) {
    magic = EIP1271_SUCCESS_RETURN_VALUE;

    (address recoveredAddress, ) = ECDSA.tryRecover(hash, signature);
    console.log("recoveredAddress sessionKey");
    console.logAddress(recoveredAddress);

    uint256 sessionId = sessions[msg.sender].sessionsBySigner[recoveredAddress];

    if (!sessions[msg.sender].sessionsById[sessionId].isOpen) {
      magic = bytes4(0);
      console.log("invalid session key");
    }
  }

  function validationHook(
    bytes32 signedHash,
    Transaction calldata transaction,
    bytes calldata _hookData
  ) external {
    (address recoveredAddress, ) = ECDSA.tryRecover(signedHash, transaction.signature);
    uint256 sessionId = sessions[msg.sender].sessionsBySigner[recoveredAddress];
    require(sessions[msg.sender].sessionsById[sessionId].validate(transaction), "Transaction rejected by session policy");
  }

  // check the spending limit of the target for the transaction
  // function onExecute(
  //   address account,
  //   address msgSender,
  //   address target,
  //   uint256 value,
  //   bytes calldata callData
  // ) internal virtual returns (bytes memory hookData) {}

  /**
   * The name of the module
   * @return name The name of the module
   */
  function name() external pure returns (string memory) {
    return "SessionKeyModule";
  }

  /**
   * Currently in dev
   * @return version The version of the module
   */
  function version() external pure returns (string memory) {
    return "0.0.0";
  }

  /*
   * Does validation and hooks transaction depending on the key
   * @param typeID The type ID to check
   * @return true if the module is of the given type, false otherwise
   */
  function isModuleType(uint256 typeID) external pure override returns (bool) {
    return typeID == MODULE_TYPE_VALIDATOR;
  }

  // /**
  //  * Get the sender of the transaction
  //  *
  //  * @return account the sender of the transaction
  //  */
  // function _getAccount() internal view returns (address account) {
  //   account = msg.sender;
  //   address _account;
  //   address forwarder;
  //   if (msg.data.length >= 40) {
  //     assembly {
  //       _account := shr(96, calldataload(sub(calldatasize(), 20)))
  //       forwarder := shr(96, calldataload(sub(calldatasize(), 40)))
  //     }
  //     if (forwarder == msg.sender) {
  //       account = _account;
  //     }
  //   }
  // }

  /*
   * Look at the transaction data to parse out what needs to be done
   */
  function preCheck(
    address msgSender,
    uint256 msgValue,
    bytes calldata msgData
  ) external returns (bytes memory hookData) {}

  /*
   * Validate data from the pre-check hook after the transaction is executed
   */
  function postCheck(bytes calldata hookData) external {}

  function preExecutionHook(Transaction calldata transaction) external returns (bytes memory context) {
    // TODO timestamp checks here
  }

  function postExecutionHook(bytes memory context) external {}
}
