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
    mapping(address => mapping(bytes4 => CallPolicy)) callPolicy;
    // (target) => empty (no selector) call policy
    mapping(address => TransferPolicy) transferPolicy;
    // timestamp when this session expires
    uint256 expiry;
    // to close the session early, flip this flag
    bool isOpen;
    // fee limit for the session
    UsageLimit feeLimit;
    UsageTracker feeTracker;
    // only used in getters / view functions
    CallTarget[] callTargets;
    address[] transferTargets;
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

  // for transfers, i.e. calls without a selector
  struct TransferPolicy {
    bool isAllowed;
    uint256 maxValuePerUse;
    UsageLimit valueLimit;
    UsageTracker valueTracker;
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

  struct CallTarget {
    address target;
    bytes4 selector;
  }

  struct SessionSpec {
    address signer;
    uint256 expiry;
    UsageLimit feeLimit;
    CallSpec[] callPolicies;
    TransferSpec[] transferPolicies;
  }

  struct CallSpec {
    address target;
    bytes4 selector;
    uint256 maxValuePerUse;
    UsageLimit valueLimit;
    Constraint[] constraints;
  }

  struct TransferSpec {
    address target;
    uint256 maxValuePerUse;
    UsageLimit valueLimit;
  }

  function checkAndUpdate(UsageLimit storage limit, UsageTracker storage tracker, uint256 value) internal {
    if (limit.limitType == LimitType.Lifetime) {
      require(tracker.lifetimeUsage + value <= limit.limit, "Lifetime limit exceeded");
      tracker.lifetimeUsage += value;
    }
    // TODO: uncomment when it's possible to check timestamps during validation
    // if (limit.limitType == LimitType.Allowance) {
    //   uint256 period = block.timestamp / limit.period;
    //   require(tracker.allowanceUsage[period] + value <= limit.limit);
    //   tracker.allowanceUsage[period] += value;
    // }
  }

  function checkAndUpdate(Constraint storage constraint, UsageTracker storage tracker, bytes calldata data) internal {
    uint256 offset = 4 + constraint.offset * 32;
    bytes32 param = bytes32(data[offset:offset + 32]);
    Condition condition = constraint.condition;
    bytes32 refValue = constraint.refValue;

    if (condition == Condition.EQUAL) {
      require(param == refValue, "EQUAL constraint not met");
    } else if (condition == Condition.GREATER_THAN) {
      require(param > refValue, "GREATER constraint not met");
    } else if (condition == Condition.LESS_THAN) {
      require(param < refValue, "LESS constraint not met");
    } else if (condition == Condition.GREATER_THAN_OR_EQUAL) {
      require(param >= refValue, "GREATER_OR_EQUAL constraint not met");
    } else if (condition == Condition.LESS_THAN_OR_EQUAL) {
      require(param <= refValue, "LESS_OR_EQUAL constraint not met");
    } else if (condition == Condition.NOT_EQUAL) {
      require(param != refValue, "NOT_EQUAL constraint not met");
    }

    constraint.limit.checkAndUpdate(tracker, uint256(param));
  }

  function validate(SessionPolicy storage policy, Transaction calldata transaction) internal {
    require(policy.isOpen, "Session is closed");

    // TODO uncomment when it's possible to check timestamps during validation
    // require(block.timestamp <= policy.expiry);

    // TODO: update fee allowance with the gasleft/refund at the end of execution
    uint256 fee = transaction.maxFeePerGas * transaction.gasLimit;
    policy.feeLimit.checkAndUpdate(policy.feeTracker, fee);

    address target = address(uint160(transaction.to));

    if (transaction.data.length >= 4) {
      bytes4 selector = bytes4(transaction.data[:4]);
      CallPolicy storage callPolicy = policy.callPolicy[target][selector];

      require(callPolicy.isAllowed, "Call not allowed");
      require(transaction.value <= callPolicy.maxValuePerUse, "Value exceeds limit");
      callPolicy.valueLimit.checkAndUpdate(callPolicy.valueTracker, transaction.value);

      for (uint256 i = 0; i < callPolicy.constraints.length; i++) {
        callPolicy.constraints[i].checkAndUpdate(callPolicy.paramTracker[i], transaction.data);
      }
    } else {
      TransferPolicy storage transferPolicy = policy.transferPolicy[target];
      require(transferPolicy.isAllowed, "Transfer not allowed");
      require(transaction.value <= transferPolicy.maxValuePerUse, "Value exceeds limit");
      transferPolicy.valueLimit.checkAndUpdate(transferPolicy.valueTracker, transaction.value);
    }
  }

  function fill(SessionPolicy storage session, SessionSpec memory newSession) internal {
    session.isOpen = true;
    session.expiry = newSession.expiry;
    session.feeLimit = newSession.feeLimit;
    for (uint256 i = 0; i < newSession.callPolicies.length; i++) {
      CallSpec memory newPolicy = newSession.callPolicies[i];
      session.callTargets.push(CallTarget({
        target: newPolicy.target,
        selector: newPolicy.selector
      }));
      CallPolicy storage callPolicy = session.callPolicy[newPolicy.target][newPolicy.selector];
      callPolicy.isAllowed = true;
      callPolicy.maxValuePerUse = newPolicy.maxValuePerUse;
      callPolicy.valueLimit = newPolicy.valueLimit;
      callPolicy.constraints = newPolicy.constraints;
    }
    for (uint256 i = 0; i < newSession.transferPolicies.length; i++) {
      TransferSpec memory newPolicy = newSession.transferPolicies[i];
      session.transferTargets.push(newPolicy.target);
      TransferPolicy storage transferPolicy = session.transferPolicy[newPolicy.target];
      transferPolicy.isAllowed = true;
      transferPolicy.maxValuePerUse = newPolicy.maxValuePerUse;
      transferPolicy.valueLimit = newPolicy.valueLimit;
    }
  }

  function getSpec(SessionPolicy storage session) internal view returns (SessionSpec memory) {
    CallSpec[] memory callPolicies = new CallSpec[](session.callTargets.length);
    TransferSpec[] memory transferPolicies = new TransferSpec[](session.transferTargets.length);
    for (uint256 i = 0; i < session.callTargets.length; i++) {
      CallTarget memory target = session.callTargets[i];
      CallPolicy storage callPolicy = session.callPolicy[target.target][target.selector];
      callPolicies[i] = CallSpec({
        target: target.target,
        selector: target.selector,
        maxValuePerUse: callPolicy.maxValuePerUse,
        valueLimit: callPolicy.valueLimit,
        constraints: callPolicy.constraints
      });
    }
    for (uint256 i = 0; i < session.transferTargets.length; i++) {
      address target = session.transferTargets[i];
      TransferPolicy storage transferPolicy = session.transferPolicy[target];
      transferPolicies[i] = TransferSpec({
        target: target,
        maxValuePerUse: transferPolicy.maxValuePerUse,
        valueLimit: transferPolicy.valueLimit
      });
    }
    return SessionSpec({
      signer: address(0),
      expiry: session.expiry,
      feeLimit: session.feeLimit,
      callPolicies: callPolicies,
      transferPolicies: transferPolicies
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
    // this only validates that the session key is linked to the account, not the transaction against the session spec
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
    require(_isInitialized(msg.sender), "Account not initialized");
    require(newSession.signer != address(0), "Invalid signer");
    require(newSession.feeLimit.limitType != SessionLib.LimitType.Unlimited, "Unlimited fee allowance is not safe");
    uint256 sessionId = sessions[msg.sender].nextSessionId++;
    sessions[msg.sender].sessionsBySigner.set(newSession.signer, sessionId);
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
    uint256 sessionId = sessions[msg.sender].sessionsBySigner.get(recoveredAddress);
    if (!sessions[msg.sender].sessionsById[sessionId].isOpen) {
      magic = bytes4(0);
    }
  }

  function validationHook(
    bytes32 signedHash,
    Transaction calldata transaction,
    bytes calldata _hookData
  ) external {
    (bytes memory signature, address validator, ) = abi.decode(transaction.signature, (bytes, address, bytes[]));
    if (validator != address(this)) {
      // This transaction is not meant to be validated by this module
      return;
    }
    (address recoveredAddress, ) = ECDSA.tryRecover(signedHash, signature);
    (bool exists, uint256 sessionId) = sessions[msg.sender].sessionsBySigner.tryGet(recoveredAddress);
    require(exists, "Invalid signer");
    sessions[msg.sender].sessionsById[sessionId].validate(transaction);
  }

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
