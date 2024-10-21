// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../interfaces/IERC7579Module.sol";
import { EnumerableMap } from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IModule } from "../interfaces/IModule.sol";
import { IValidationHook } from "../interfaces/IHook.sol";
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
    // (target, selector) => call policy
    mapping(address => mapping(bytes4 => CallPolicy)) policy;
    // for view functions
    FullTarget[] allowedTargets;
    // timestamp when this session expires
    uint256 expiry;
    // to close the session early, flip this flag
    bool isOpen;
    // fee limit for the session
    UsageLimit feeLimit;
    UsageTracker feeTracker;
  }

  struct CallPolicy {
    // this flag is needed, as otherwise, an empty CallPolicy (default mapping entry)
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

  struct FullTarget {
    address target;
    bytes4 selector;
  }

  struct SessionSpec {
    address signer;
    uint256 expiry;
    UsageLimit feeLimit;
    CallSpec[] policies;
  }

  struct CallSpec {
    address target;
    bytes4 selector;
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
    CallPolicy storage callPolicy = policy.policy[target][selector];

    console.log("function validation");
    if (!callPolicy.isAllowed) {
      return false;
    }
    console.log("value validation");
    if (transaction.value > callPolicy.maxValuePerUse) {
      return false;
    }
    console.log("value limit check");
    if (!callPolicy.valueLimit.checkAndUpdate(callPolicy.valueTracker, transaction.value)) {
      return false;
    }

    for (uint256 i = 0; i < callPolicy.constraints.length; i++) {
      console.log("param validation", i);
      if (!callPolicy.constraints[i].checkAndUpdate(callPolicy.paramTracker[i], transaction.data)) {
        return false;
      }
    }

    return true;
  }

  function fill(SessionPolicy storage session, SessionSpec memory newSession) internal {
    session.isOpen = true;
    session.expiry = newSession.expiry;
    session.feeLimit = newSession.feeLimit;
    for (uint256 i = 0; i < newSession.policies.length; i++) {
      CallSpec memory newPolicy = newSession.policies[i];
      session.allowedTargets.push(FullTarget({
        target: newPolicy.target,
        selector: newPolicy.selector
      }));
      CallPolicy storage callPolicy = session.policy[newPolicy.target][newPolicy.selector];
      callPolicy.isAllowed = true;
      callPolicy.maxValuePerUse = newPolicy.maxValuePerUse;
      callPolicy.valueLimit = newPolicy.valueLimit;
      callPolicy.constraints = newPolicy.constraints;
    }
  }

  function getSpec(SessionPolicy storage session) internal view returns (SessionSpec memory) {
    CallSpec[] memory policies = new CallSpec[](session.allowedTargets.length);
    for (uint256 i = 0; i < session.allowedTargets.length; i++) {
      FullTarget memory target = session.allowedTargets[i];
      CallPolicy storage callPolicy = session.policy[target.target][target.selector];
      policies[i] = CallSpec({
        target: target.target,
        selector: target.selector,
        maxValuePerUse: callPolicy.maxValuePerUse,
        valueLimit: callPolicy.valueLimit,
        constraints: callPolicy.constraints
      });
    }
    return SessionSpec({
      signer: address(0),
      expiry: session.expiry,
      feeLimit: session.feeLimit,
      policies: policies
    });
  }
}

contract SessionKeyValidator is IHook, IValidationHook, IModuleValidator, IModule {
  using SessionLib for SessionLib.SessionPolicy;
  using EnumerableMap for EnumerableMap.AddressToUintMap;

  bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

  struct AccountSessions {
    // id => session
    mapping(uint256 => SessionLib.SessionPolicy) sessionsById;
    // signer => id
    EnumerableMap.AddressToUintMap sessionsBySigner;
    // should start with 1
    uint256 nextSessionId;
  }

  mapping(address => AccountSessions) private sessions;

  function sessionBySigner(address account, address signer) public view returns (SessionLib.SessionSpec memory spec) {
    uint256 id = sessions[account].sessionsBySigner.get(signer);
    spec = sessions[account].sessionsById[id].getSpec();
    spec.signer = signer;
  }

  function sessionsList(address account) external view returns (SessionLib.SessionSpec[] memory specs) {
    specs = new SessionLib.SessionSpec[](sessions[account].sessionsBySigner.length());
    for (uint256 i = 0; i < specs.length; i++) {
      (address signer, ) = sessions[account].sessionsBySigner.at(i);
      specs[i] = sessionBySigner(account, signer);
    }
  }

  function handleValidation(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    // this only validates that the session key is linked to the account, not the spend limit
    return isValidSignature(signedHash, signature) == EIP1271_SUCCESS_RETURN_VALUE;
  }

  // TODO what bool does it return?
  function addValidationKey(bytes memory sessionData) external returns (bool) {
    if (sessionData.length == 0) {
      return false;
    }
    SessionLib.SessionSpec memory newSession = abi.decode(sessionData, (SessionLib.SessionSpec));
    createSession(newSession);
    return true;
  }

  function createSession(SessionLib.SessionSpec memory newSession) public {
    console.log("createSession");
    require(_isInitialized(msg.sender), "Account not initialized");
    require(newSession.signer != address(0), "Invalid signer");
    console.log("passed requies");
    uint256 sessionId = sessions[msg.sender].nextSessionId++;
    sessions[msg.sender].sessionsBySigner.set(newSession.signer, sessionId);
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
    if (sessions[msg.sender].nextSessionId == 0) {
      sessions[msg.sender].nextSessionId = 1;
    }
  }

  function onUninstall(bytes calldata) external override {
    _uninstall();
  }

  // FIXME should also revoke all active session keys somehow
  function disable() external {
    if (_isInitialized(msg.sender)) {
      _uninstall();
      IValidatorManager(msg.sender).removeModuleValidator(address(this));
      IHookManager(msg.sender).removeHook(address(this), true);
    }
  }

  function _uninstall() internal {
    // Here we have to revoke all keys, so that if the module
    // is installed again later, there will be no active sessions from the past.
    // Problem: if there are too many keys, this will run out of gas.
    // Solution: before uninstalling, require that all keys are revoked manually.
    require(sessions[msg.sender].sessionsBySigner.length() == 0, "Revoke all keys first");
  }

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return interfaceId != 0xffffffff && (
      interfaceId == type(IERC165).interfaceId ||
      interfaceId == type(IValidationHook).interfaceId ||
      interfaceId == type(IModuleValidator).interfaceId ||
      interfaceId == type(IModule).interfaceId
    );
  }

  function revokeKey(address sessionOwner) external returns (bool) {
    require(_isInitialized(msg.sender), "Account not initialized");
    return sessions[msg.sender].sessionsBySigner.remove(sessionOwner);
  }

  function revokeKeys(address[] calldata sessionOwners) external {
    require(_isInitialized(msg.sender), "Account not initialized");
    for (uint256 i = 0; i < sessionOwners.length; i++) {
      sessions[msg.sender].sessionsBySigner.remove(sessionOwners[i]);
    }
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
    return IHookManager(smartAccount).isHook(address(this));
      // && IValidatorManager(smartAccount).isModuleValidator(address(this));
  }

  /*
   * Currently doing 1271 validation, but might update the interface to match the zksync account validation
   */
  function isValidSignature(bytes32 hash, bytes memory signature) public view returns (bytes4 magic) {
    magic = EIP1271_SUCCESS_RETURN_VALUE;

    (address recoveredAddress, ) = ECDSA.tryRecover(hash, signature);
    console.log("recoveredAddress sessionKey");
    console.logAddress(recoveredAddress);

    uint256 sessionId = sessions[msg.sender].sessionsBySigner.get(recoveredAddress);

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
    (bool exists, uint256 sessionId) = sessions[msg.sender].sessionsBySigner.tryGet(recoveredAddress);
    if (!exists) {
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
}
