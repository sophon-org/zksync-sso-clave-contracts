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

import { IHookManager } from "../interfaces/IHookManager.sol";
import { IValidatorManager } from "../interfaces/IValidatorManager.sol";

import "hardhat/console.sol";

library SessionLib {
  using SessionLib for SessionLib.Constraint;
  using SessionLib for SessionLib.UsageLimit;


  struct SessionPolicy {
    // FIXME: add ability to call without a selector
    // (target, selector) => function policy
    mapping(address => mapping(bytes4 => FunctionPolicy)) policy;
    // timestamp when this session expires
    uint256 expiry;
    // to close the session early, flip this flag
    bool isOpen;
    // fee limit for the session
    UsageLimit feeLimit;
    UsageTracker feeTracker;
  }

  struct FunctionPolicy {
    // this flag is needed, as otherwise, an empty FunctionPolicy (default mapping entry)
    // would mean no constraints
    bool isAllowed;
    uint256 maxValuePerUse;

    UsageLimit valueLimit;
    UsageTracker valueTracker;

    Constraint[] constraints;
    mapping(uint256 => UsageTracker) paramTracker;
  }

  struct Constraint {
    Condition condition;
    uint64 offset;
    bytes32 refValue;
    UsageLimit limit;
  }

  struct UsageTracker {
    uint256 lifetimeUsage;
    // period => used that period
    mapping(uint256 => uint256) allowanceUsage;
  }

  struct UsageLimit {
    LimitType limitType;
    uint256 limit;
    uint256 period; // ignored if limitType != Allowance
  }

  enum LimitType {
    Unlimited,
    Lifetime,
    Allowance
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
    UsageLimit feeLimit;
    NewFunctionPolicy[] policies;
  }

  struct NewFunctionPolicy {
    bytes4 selector;
    address target;
    uint256 maxValuePerUse;
    UsageLimit valueLimit;
    Constraint[] constraints;
  }

  function checkAndUpdate(UsageLimit storage limit, UsageTracker storage tracker, uint256 value) internal returns (bool) {
    if (limit.limitType == LimitType.Lifetime) {
      if (tracker.lifetimeUsage + value > limit.limit) {
        return false;
      }
      tracker.lifetimeUsage += value;
    }
    // TODO: uncomment when it's possible to check timestamps during validation
    // if (limit.limitType == LimitType.Allowance) {
    //   uint256 period = block.timestamp / limit.period;
    //   if (tracker.allowanceUsage[period] + value > limit.limit) {
    //     return false;
    //   }
    //   tracker.allowanceUsage[period] += value;
    // }
    return true;
  }

  function checkAndUpdate(Constraint storage constraint, UsageTracker storage tracker, bytes calldata data) internal returns (bool) {
    console.log("param validation started");
    uint256 offset = 4 + constraint.offset * 32;
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

    console.log("condition validated");
    if (!constraint.limit.checkAndUpdate(tracker, uint256(param))) {
      return false;
    }
    console.log("limit validated");

    return true;
  }

  function validate(SessionPolicy storage policy, Transaction calldata transaction) internal returns (bool) {
    console.log("validation started");
    if (!policy.isOpen) {
      return false;
    }

    // TODO uncomment when it's possible to check timestamps during validation
    // if (block.timestamp > policy.expiry) {
    //   policy.isOpen = false;
    //   return false;
    // }

    console.log("fee validation");
    uint256 fee = transaction.maxFeePerGas * transaction.gasLimit;
    if (!policy.feeLimit.checkAndUpdate(policy.feeTracker, fee)) {
      return false;
    }

    bytes4 selector;
    // FIXME this is a temporary solution.
    // We should probably have a separate (OPTIONAL) policy for calls without data
    if (transaction.data.length >= 4) {
      selector = bytes4(transaction.data[:4]);
    } else {
      selector = bytes4(0);
    }
    address target = address(uint160(transaction.to));
    FunctionPolicy storage functionPolicy = policy.policy[target][selector];

    console.log("function validation");
    if (!functionPolicy.isAllowed) {
      return false;
    }
    console.log("value validation");
    if (transaction.value > functionPolicy.maxValuePerUse) {
      return false;
    }
    console.log("value limit check");
    if (!functionPolicy.valueLimit.checkAndUpdate(functionPolicy.valueTracker, transaction.value)) {
      return false;
    }

    for (uint256 i = 0; i < functionPolicy.constraints.length; i++) {
      console.log("param validation", i);
      if (!functionPolicy.constraints[i].checkAndUpdate(functionPolicy.paramTracker[i], transaction.data)) {
        return false;
      }
    }

    return true;
  }


  // function validateTimestamps(SessionPolicy storage policy, Transaction calldata transaction) internal returns (bool) {
  //   if (block.timestamp > policy.expiry) {
  //     policy.isOpen = false;
  //     return false;
  //   }
  //
  //   bytes4 selector;
  //   // FIXME this is a temporary solution.
  //   // We should probably have a separate policy for calls without data
  //   if (transaction.data.length >= 4) {
  //     selector = bytes4(transaction.data[:4]);
  //   } else {
  //     selector = bytes4(0);
  //   }
  //   address target = address(uint160(transaction.to));
  //   FunctionPolicy storage functionPolicy = policy.policy[target][selector];
  //
  //   for (uint256 i = 0; i < functionPolicy.paramConstraints.length; i++) {
  //     Constraint storage constraint = functionPolicy.paramConstraints[i];
  //     uint256 offset = 4 + constraint.offset * 32;
  //     bytes32 param = bytes32(transaction.data[offset:offset + 32]);
  //     if (constraint.allowance.isLimited) {
  //       uint256 period = block.timestamp / constraint.allowance.timePeriod;
  //       uint256 newUsed = constraint.allowance.used[period] + uint256(param);
  //       if (newUsed > constraint.allowance.limit) {
  //         return false;
  //       }
  //       constraint.allowance.used[period] = newUsed;
  //     }
  //   }
  // }

  function fill(SessionPolicy storage session, NewSession memory newSession) internal {
    session.isOpen = true;
    session.expiry = newSession.expiry;
    session.feeLimit = newSession.feeLimit;
    for (uint256 i = 0; i < newSession.policies.length; i++) {
      NewFunctionPolicy memory newFunctionPolicy = newSession.policies[i];
      FunctionPolicy storage functionPolicy = session.policy[newFunctionPolicy.target][newFunctionPolicy.selector];
      functionPolicy.isAllowed = true;
      functionPolicy.maxValuePerUse = newFunctionPolicy.maxValuePerUse;
      functionPolicy.valueLimit = newFunctionPolicy.valueLimit;
      functionPolicy.constraints = newFunctionPolicy.constraints;
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
    createSession(newSession);
    return true;
  }

  function createSession(SessionLib.NewSession memory newSession) public {
    console.log("createSession");
    require(_isInitialized(msg.sender), "Account not initialized");
    require(newSession.signer != address(0), "Invalid signer");
    console.log("passed requies");
    uint256 sessionId = sessions[msg.sender].nextSessionId++;
    sessions[msg.sender].sessionsBySigner[newSession.signer] = sessionId;
    console.log("set session id", sessionId);
    SessionLib.SessionPolicy storage session = sessions[msg.sender].sessionsById[sessionId];
    session.fill(newSession);
  }

  function init(bytes calldata data) external {
    // to prevent recursion, since addHook also calls init
    if (!_isInitialized(msg.sender)) {
      _install(data);
      IValidatorManager(msg.sender).addModuleValidator(address(this), data);
      IHookManager(msg.sender).addHook(abi.encodePacked(address(this)), true);
    }
  }

  function onInstall(bytes calldata data) external override {
    // TODO
    _install(data);
  }

  function _install(bytes calldata data) internal {
    uint256 nextId = sessions[msg.sender].nextSessionId;
    if (nextId == 0) {
      sessions[msg.sender].nextSessionId = 1;
    }
  }

  function onUninstall(bytes calldata) external override {}

  // FIXME should also revoke all active session keys somehow
  function disable() external {
    if (_isInitialized(msg.sender)) {
      IValidatorManager(msg.sender).removeModuleValidator(address(this));
      IHookManager(msg.sender).removeHook(address(this), true);
    }
  }

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    // found by example
    return interfaceId == 0x01ffc9a7 || interfaceId == 0xffffffff;
  }

  function revokeKey(address sessionOwner) external {
    require(_isInitialized(msg.sender), "Account not initialized");
    sessions[msg.sender].sessionsBySigner[sessionOwner] = 0;
  }

  /*
   * If there are any spend limits configured
   * @param smartAccount The smart account to check
   * @return true if spend limits are configured initialized, false otherwise
   */
  function isInitialized(address smartAccount) external view returns (bool) {
    return _isInitialized(smartAccount);
  }

  function _isInitialized(address smartAccount) internal view returns (bool) {
    return IHookManager(msg.sender).isHook(address(this));
      // && IValidatorManager(msg.sender).isModuleValidator(address(this));
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
    (bytes memory signature, , ) = abi.decode(transaction.signature, (bytes, address, bytes[]));
    (address recoveredAddress, ) = ECDSA.tryRecover(signedHash, signature);
    uint256 sessionId = sessions[msg.sender].sessionsBySigner[recoveredAddress];
    if (sessionId == 0) {
      // This transaction was not signed by a session key,
      // and will either be rejected on the signature validation step,
      // or does not use session key validator, in which case we don't care.
      return;
    }
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
    return "SessionKeyValidator";
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
