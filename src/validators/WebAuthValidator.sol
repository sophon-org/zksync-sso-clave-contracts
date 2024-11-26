// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IModuleValidator } from "../interfaces/IModuleValidator.sol";
import { JsmnSolLib } from "../libraries/JsmnSolLib.sol";
import { VerifierCaller } from "../helpers/VerifierCaller.sol";
import { Base64 } from "../helpers/Base64.sol";

/**
 * @title validator contract for passkey r1 signatures
 */
contract WebAuthValidator is VerifierCaller, IERC165, IModuleValidator {
  // The layout is weird due to EIP-7562 storage read restrictions for validation phase.
  mapping(string originDomain => mapping(address accountAddress => bytes32)) public lowerKeyHalf;
  mapping(string originDomain => mapping(address accountAddress => bytes32)) public upperKeyHalf;

  // user presence and user verification flags
  bytes1 constant AUTH_DATA_MASK = 0x05;

  // maximum value for 's' in a secp256r1 signature
  bytes32 constant lowSmax = 0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8;

  function addValidationKey(bytes memory key) external returns (bool) {
    (bytes32[2] memory key32, string memory originDomain) = abi.decode(key, (bytes32[2], string));
    bytes32 initialLowerHalf = lowerKeyHalf[originDomain][msg.sender];
    bytes32 initialUpperHalf = upperKeyHalf[originDomain][msg.sender];

    // we might want to support multiple passkeys per domain
    lowerKeyHalf[originDomain][msg.sender] = key32[0];
    upperKeyHalf[originDomain][msg.sender] = key32[1];

    // we're returning true if this was a new key, false for update
    return initialLowerHalf == 0 && initialUpperHalf == 0;
  }

  function handleValidation(bytes32 signedHash, bytes memory signature) external view returns (bool) {
    return webAuthVerify(signedHash, signature);
  }

  function webAuthVerify(bytes32 transactionHash, bytes memory fatSignature) internal view returns (bool valid) {
    (bytes memory authenticatorData, string memory clientDataJSON, bytes32[2] memory rs) = abi.decode(
      fatSignature,
      (bytes, string, bytes32[2])
    );

    if (rs[1] > lowSmax) {
      return false;
    }

    // check if the flags are set
    if (authenticatorData[32] & AUTH_DATA_MASK != AUTH_DATA_MASK) {
      return false;
    }

    // parse out the important fields (type, challenge, and origin): https://goo.gl/yabPex
    // TODO: test if the parse fails for more than 10 elements, otherwise can have a malicious header
    (uint returnValue, JsmnSolLib.Token[] memory tokens, uint actualNum) = JsmnSolLib.parse(clientDataJSON, 20);
    if (returnValue != 0) {
      return false;
    }

    bytes32[2] memory pubKey;

    // look for fields by name, then compare to expected values
    bool validChallenge = false;
    bool validType = false;
    bool validOrigin = false;
    bool invalidCrossOrigin = false;
    for (uint256 index = 1; index < actualNum; index++) {
      JsmnSolLib.Token memory t = tokens[index];
      if (t.jsmnType == JsmnSolLib.JsmnType.STRING) {
        string memory keyOrValue = JsmnSolLib.getBytes(clientDataJSON, t.start, t.end);
        if (Strings.equal(keyOrValue, "challenge")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory challengeValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validChallenge) {
            return false;
          }
          // this is the key part to ensure the signature is for the provided transaction
          bytes memory challengeDataArray = Base64.decode(challengeValue);
          if (challengeDataArray.length != 32) {
            // wrong hash size
            return false;
          }
          bytes32 challengeData = abi.decode(challengeDataArray, (bytes32));

          validChallenge = challengeData == transactionHash;
        } else if (Strings.equal(keyOrValue, "type")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory typeValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validType) {
            return false;
          }
          validType = Strings.equal("webauthn.get", typeValue);
        } else if (Strings.equal(keyOrValue, "origin")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory originValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (validOrigin) {
            return false;
          }
          pubKey[0] = lowerKeyHalf[originValue][msg.sender];
          pubKey[1] = upperKeyHalf[originValue][msg.sender];

          // This really only validates the origin is set
          validOrigin = pubKey[0] != 0 && pubKey[1] != 0;
        } else if (Strings.equal(keyOrValue, "crossOrigin")) {
          JsmnSolLib.Token memory nextT = tokens[index + 1];
          string memory crossOriginValue = JsmnSolLib.getBytes(clientDataJSON, nextT.start, nextT.end);
          // this should only be set once, otherwise this is an error
          if (!invalidCrossOrigin) {
            return false;
          }
          invalidCrossOrigin = Strings.equal("true", crossOriginValue);
        }
      }
    }

    if (!validChallenge || !validType || !validOrigin || invalidCrossOrigin) {
      return false;
    }

    bytes32 clientDataHash = sha256(bytes(clientDataJSON));
    bytes32 message = sha256(bytes.concat(authenticatorData, clientDataHash));
    valid = callVerifier(address(0x100), message, rs, pubKey);
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
    return interfaceId == type(IERC165).interfaceId || interfaceId == type(IModuleValidator).interfaceId;
  }
}
