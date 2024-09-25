// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import "./PasskeyValidator.sol";

import "hardhat/console.sol";

/**
 * @title validator contract for passkey r1 signatures
 * @author https://getclave.io
 */
contract WebAuthValidator is PasskeyValidator, IModuleValidator {
  // each inner array should be two 32byte words
  mapping(address => bytes32[2][]) accountAddressToKeys;

  function addValidationKey(bytes memory key) external returns (bool) {
    bytes32[2] memory key32 = abi.decode(key, (bytes32[2]));
    accountAddressToKeys[msg.sender].push(key32);
    return true;
  }

  function handleValidation(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    bytes32[2][] memory validationKeys = accountAddressToKeys[msg.sender];

    for (uint256 validationKeyIndex = 0; validationKeyIndex < validationKeys.length; validationKeyIndex++) {
      // Printing this hash makes capturing this for a replay test easier
      console.log("signed hash");
      console.logBytes32(signedHash);
      bytes32[2] memory key = validationKeys[validationKeyIndex];

      // address(this) might be wrong when doing a proxy account
      bool _success = webAuthVerify(signedHash, signature, key);

      if (_success) {
        return true;
      }
    }

    return false;
  }

  function webAuthVerify(
    bytes32 transactionHash,
    bytes memory fatSignature,
    bytes32[2] memory pubKey
  ) internal view returns (bool valid) {
    (bytes memory authenticatorData, string memory clientDataJSON, bytes32[2] memory rs) = _decodeFatSignature(
      fatSignature
    );

    console.log("authenticatorData");
    console.logBytes(authenticatorData);
    console.log("clientDataJSON");
    console.logString(clientDataJSON);
    // malleability check
    if (rs[1] > lowSmax) {
      console.log("malleability check failed");
      // return false; // XXX FIXME REMOVED WHILE TESTING DO NOT SHIP
    }

    // check if the flags are set
    if (authenticatorData[32] & AUTH_DATA_MASK != AUTH_DATA_MASK) {
      console.log("auth data mask failed");
      // return false; // XXX FIXME REMOVED WHILE TESTING DO NOT SHIP
    }

    // parse out the important fields (type, challenge, and origin): https://goo.gl/yabPex
    // TODO: test if the parse fails for more than 10 elements, otherwise can have a malicious header
    (uint returnValue, JsmnSolLib.Token[] memory tokens, uint actualNum) = JsmnSolLib.parse(clientDataJSON, 20);
    if (returnValue != 0) {
      console.log("failed to parse json");
      console.logUint(returnValue);
      return false;
    }

    // look for fields by name, then compare to expected values
    bool validChallenge = false;
    bool validType = false;
    for (uint256 index = 1; index < actualNum; index++) {
      JsmnSolLib.Token memory t = tokens[index];
      if (t.jsmnType == JsmnSolLib.JsmnType.STRING) {
        string memory keyOrValue = JsmnSolLib.getBytes(clientDataJSON, t.start, t.end);
        if (Strings.equal(keyOrValue, "challenge")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory challengeValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validChallenge) {
            console.log("duplicate challange, bad json!");
            return false;
          }
          // this is the key part to ensure the signature is for the provided transaction
          bytes memory challengeDataArray = Base64.decode(challengeValue);
          if (challengeDataArray.length != 32) {
            // wrong hash size
            console.log("invalid hash data length in json challange field");
            return false;
          }
          bytes32 challengeData = abi.decode(challengeDataArray, (bytes32));

          validChallenge = challengeData == transactionHash;
          console.log("validChallenge");
          console.logBool(validChallenge);
        } else if (Strings.equal(keyOrValue, "type")) {
          string memory keyOrValue = JsmnSolLib.getBytes(clientDataJSON, t.start, t.end);
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory typeValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validType) {
            console.log("duplicate type field, bad json");
            return false;
          }
          validType = Strings.equal("webauthn.get", typeValue);
          console.log("valid type");
          console.logBool(validType);
        }
        // TODO: provide & check 'origin' and/or 'cross-origin' keys as part of signature
      }
    }

    if (!validChallenge || !validType) {
      console.log("invalid challenge or type");
      return false;
    }

    bytes32 message = _createMessage(authenticatorData, bytes(clientDataJSON));
    valid = callVerifier(P256_VERIFIER, message, rs, pubKey);
  }
}
