// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../interfaces/IERC7579Module.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
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

  enum Status {
    NotInitialized,
    Active,
    Closed
  }

  struct UsageTrackers {
    UsageTracker fee;
    mapping(address => UsageTracker) transferValue;
    mapping(address => mapping(bytes4 => UsageTracker)) callValue;
    mapping(address => mapping(bytes4 => mapping(uint256 => UsageTracker))) params;
  }

  // This struct has weird layout because of the AA storage access restrictions for validation
  struct SessionStorage {
    // (target, selector) => call policy
    mapping(address => mapping(bytes4 => mapping(address => CallPolicy))) callPolicy;
    // (target) => empty (no selector) call policy
    mapping(address => mapping(address => TransferPolicy)) transferPolicy;
    mapping(address => Status) status;
    mapping(address => uint256) expiry;
    mapping(address => UsageLimit) feeLimit;

    UsageTrackers trackers;

    // only used in getters / view functions, not used during validation
    mapping(address => CallTarget[]) callTargets;
    mapping(address => address[]) transferTargets;
  }

  struct CallPolicy {
    // this flag is needed, as otherwise, an empty CallPolicy (default mapping entry)
    // would mean no constraints
    bool isAllowed;
    uint256 maxValuePerUse;
    UsageLimit valueLimit;

    uint256 totalConstraints;
    Constraint[16] constraints;
  }

  // for transfers, i.e. calls without a selector
  struct TransferPolicy {
    bool isAllowed;
    uint256 maxValuePerUse;
    UsageLimit valueLimit;
  }

  struct Constraint {
    Condition condition;
    uint64 offset;
    bytes32 refValue;
    UsageLimit limit;
  }

  struct UsageTracker {
    mapping(address => uint256) lifetimeUsage;
    // period => used that period
    mapping(uint256 => mapping(address => uint256)) allowanceUsage;
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
    Unconstrained,
    Equal,
    Greater,
    Less,
    GreaterOrEqual,
    LessOrEqual,
    NotEqual
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
    // add max data length restriction?
    // add max number of calls restriction?
  }

  struct TransferSpec {
    address target;
    uint256 maxValuePerUse;
    UsageLimit valueLimit;
  }

  function checkAndUpdate(UsageLimit storage limit, UsageTracker storage tracker, uint256 value) internal {
    if (limit.limitType == LimitType.Lifetime) {
      require(tracker.lifetimeUsage[msg.sender] + value <= limit.limit, "Lifetime limit exceeded");
      tracker.lifetimeUsage[msg.sender] += value;
    }
    // TODO: uncomment when it's possible to check timestamps during validation
    // if (limit.limitType == LimitType.Allowance) {
    //   uint256 period = block.timestamp / limit.period;
    //   require(tracker.allowanceUsage[period] + value <= limit.limit);
    //   tracker.allowanceUsage[period] += value;
    // }
  }

  function checkAndUpdate(Constraint storage constraint, UsageTracker storage tracker, bytes calldata data) internal {
    if (constraint.condition == Condition.Unconstrained && constraint.limit.limitType == LimitType.Unlimited) {
      return;
    }

    uint256 offset = 4 + constraint.offset * 32;
    bytes32 param = bytes32(data[offset:offset + 32]);
    Condition condition = constraint.condition;
    bytes32 refValue = constraint.refValue;

    if (condition == Condition.Equal) {
      require(param == refValue, "EQUAL constraint not met");
    } else if (condition == Condition.Greater) {
      require(param > refValue, "GREATER constraint not met");
    } else if (condition == Condition.Less) {
      require(param < refValue, "LESS constraint not met");
    } else if (condition == Condition.GreaterOrEqual) {
      require(param >= refValue, "GREATER_OR_EQUAL constraint not met");
    } else if (condition == Condition.LessOrEqual) {
      require(param <= refValue, "LESS_OR_EQUAL constraint not met");
    } else if (condition == Condition.NotEqual) {
      require(param != refValue, "NOT_EQUAL constraint not met");
    }

    constraint.limit.checkAndUpdate(tracker, uint256(param));
  }

  function validate(SessionStorage storage session, Transaction calldata transaction) internal {
    require(session.status[msg.sender] == Status.Active, "Session is not active");

    // TODO uncomment when it's possible to check timestamps during validation
    // require(block.timestamp <= session.expiry);

    // TODO: update fee allowance with the gasleft/refund at the end of execution
    uint256 fee = transaction.maxFeePerGas * transaction.gasLimit;
    session.feeLimit[msg.sender].checkAndUpdate(session.trackers.fee, fee);

    address target = address(uint160(transaction.to));

    if (transaction.data.length >= 4) {
      bytes4 selector = bytes4(transaction.data[:4]);
      CallPolicy storage callPolicy = session.callPolicy[target][selector][msg.sender];

      require(callPolicy.isAllowed, "Call not allowed");
      require(transaction.value <= callPolicy.maxValuePerUse, "Value exceeds limit");
      callPolicy.valueLimit.checkAndUpdate(session.trackers.callValue[target][selector], transaction.value);

      for (uint256 i = 0; i < callPolicy.totalConstraints; i++) {
        callPolicy.constraints[i].checkAndUpdate(session.trackers.params[target][selector][i], transaction.data);
      }
    } else {
      TransferPolicy storage transferPolicy = session.transferPolicy[target][msg.sender];
      require(transferPolicy.isAllowed, "Transfer not allowed");
      require(transaction.value <= transferPolicy.maxValuePerUse, "Value exceeds limit");
      transferPolicy.valueLimit.checkAndUpdate(session.trackers.transferValue[target], transaction.value);
    }
  }

  function fill(SessionStorage storage session, SessionSpec memory newSession, address account) internal {
    session.status[account] = Status.Active;
    session.expiry[account] = newSession.expiry;
    session.feeLimit[account] = newSession.feeLimit;
    for (uint256 i = 0; i < newSession.callPolicies.length; i++) {
      CallSpec memory newPolicy = newSession.callPolicies[i];
      session.callTargets[account].push(CallTarget({
        target: newPolicy.target,
        selector: newPolicy.selector
      }));
      CallPolicy storage callPolicy = session.callPolicy[newPolicy.target][newPolicy.selector][account];
      callPolicy.isAllowed = true;
      callPolicy.maxValuePerUse = newPolicy.maxValuePerUse;
      callPolicy.valueLimit = newPolicy.valueLimit;
      require(newPolicy.constraints.length <= 16, "Too many constraints");
      callPolicy.totalConstraints = newPolicy.constraints.length;
      for (uint256 j = 0; j < newPolicy.constraints.length; j++) {
        callPolicy.constraints[j] = newPolicy.constraints[j];
      }
    }
    for (uint256 i = 0; i < newSession.transferPolicies.length; i++) {
      TransferSpec memory newPolicy = newSession.transferPolicies[i];
      session.transferTargets[account].push(newPolicy.target);
      TransferPolicy storage transferPolicy = session.transferPolicy[newPolicy.target][account];
      transferPolicy.isAllowed = true;
      transferPolicy.maxValuePerUse = newPolicy.maxValuePerUse;
      transferPolicy.valueLimit = newPolicy.valueLimit;
    }
  }

  function getSpec(SessionStorage storage session, address account) internal view returns (Status, SessionSpec memory) {
    CallSpec[] memory callPolicies = new CallSpec[](session.callTargets[account].length);
    TransferSpec[] memory transferPolicies = new TransferSpec[](session.transferTargets[account].length);
    for (uint256 i = 0; i < session.callTargets[account].length; i++) {
      CallTarget memory target = session.callTargets[account][i];
      CallPolicy storage callPolicy = session.callPolicy[target.target][target.selector][account];
      Constraint[] memory constraints = new Constraint[](callPolicy.totalConstraints);
      for (uint256 j = 0; j < callPolicy.totalConstraints; j++) {
        constraints[j] = callPolicy.constraints[j];
      }
      callPolicies[i] = CallSpec({
        target: target.target,
        selector: target.selector,
        maxValuePerUse: callPolicy.maxValuePerUse,
        valueLimit: callPolicy.valueLimit,
        constraints: constraints
      });
    }
    for (uint256 i = 0; i < session.transferTargets[account].length; i++) {
      address target = session.transferTargets[account][i];
      TransferPolicy storage transferPolicy = session.transferPolicy[target][account];
      transferPolicies[i] = TransferSpec({
        target: target,
        maxValuePerUse: transferPolicy.maxValuePerUse,
        valueLimit: transferPolicy.valueLimit
      });
    }
    return (session.status[account], SessionSpec({
      signer: address(0),
      expiry: session.expiry[account],
      feeLimit: session.feeLimit[account],
      callPolicies: callPolicies,
      transferPolicies: transferPolicies
    }));
  }
}

contract SessionKeyValidator is IHook, IValidationHook, IModuleValidator, IModule {
  using SessionLib for SessionLib.SessionStorage;
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

  // session owner => session storage
  mapping(address => SessionLib.SessionStorage) private sessions;
  // account => owners
  mapping(address => EnumerableSet.AddressSet) sessionOwners;

  function getSession(address account, address signer) public view returns (SessionLib.Status status, SessionLib.SessionSpec memory spec) {
    (status, spec) = sessions[signer].getSpec(account);
    spec.signer = signer;
  }

  function sessionList(address account) external view returns (SessionLib.Status[] memory statuses, SessionLib.SessionSpec[] memory specs) {
    specs = new SessionLib.SessionSpec[](sessionOwners[account].length());
    statuses = new SessionLib.Status[](specs.length);
    for (uint256 i = 0; i < specs.length; i++) {
      address signer = sessionOwners[account].at(i);
      (statuses[i], specs[i]) = getSession(account, signer);
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
    require(sessions[newSession.signer].status[msg.sender] == SessionLib.Status.NotInitialized, "Session already exists");
    require(newSession.feeLimit.limitType != SessionLib.LimitType.Unlimited, "Unlimited fee allowance is not safe");
    sessionOwners[msg.sender].add(newSession.signer);
    sessions[newSession.signer].fill(newSession, msg.sender);
  }

  function init(bytes calldata data) external {
    // to prevent recursion, since addHook also calls init
    if (!_isInitialized(msg.sender)) {
      IValidatorManager(msg.sender).addModuleValidator(address(this), data);
      IHookManager(msg.sender).addHook(abi.encodePacked(address(this)), true);
    }
  }

  function onInstall(bytes calldata data) external override {
    // TODO
  }


  function onUninstall(bytes calldata) external override {
    // TODO
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
    require(sessionOwners[msg.sender].length() == 0, "Revoke all keys first");
  }

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return interfaceId != 0xffffffff && (
      interfaceId == type(IERC165).interfaceId ||
      interfaceId == type(IValidationHook).interfaceId ||
      interfaceId == type(IModuleValidator).interfaceId ||
      interfaceId == type(IModule).interfaceId
    );
  }

  // TODO: make the session owner able revoke its own key, in case it was leaked, to prevent further misuse?
  function revokeKey(address sessionOwner) public {
    require(sessions[sessionOwner].status[msg.sender] == SessionLib.Status.Active, "Nothing to revoke");
    sessions[sessionOwner].status[msg.sender] = SessionLib.Status.Closed;
    sessionOwners[msg.sender].remove(sessionOwner);
  }

  function revokeKeys(address[] calldata owners) external {
    for (uint256 i = 0; i < owners.length; i++) {
      revokeKey(owners[i]);
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
    SessionLib.Status status = sessions[recoveredAddress].status[msg.sender];
    if (status != SessionLib.Status.Active) {
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
    require(recoveredAddress != address(0), "Invalid signer");
    sessions[recoveredAddress].validate(transaction);
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
