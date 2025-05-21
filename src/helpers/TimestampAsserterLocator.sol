// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ITimestampAsserter } from "../interfaces/ITimestampAsserter.sol";
import { Errors } from "../libraries/Errors.sol";

/// @title Timestamp asserter locator
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @notice This library is used to locate the TimestampAsserter contract on different networks.
/// @dev Might be removed in the future, when TimestampAsserter is deployed via create2 to the same address on all networks.
library TimestampAsserterLocator {
  function locate() internal view returns (ITimestampAsserter) {
    // sophon mainnet
    if (block.chainid == 50104) {
      return ITimestampAsserter(address(0x391e96be889DEF917c6588f37B1ec36FF6292907));
    }
    // sophon sepolia testnet
    if (block.chainid == 531050104) {
      return ITimestampAsserter(address(0x391e96be889DEF917c6588f37B1ec36FF6292907));
    }
    // era mainnet
    if (block.chainid == 324) {
      return ITimestampAsserter(address(0x958F70e4Fd676c9CeAaFe5c48cB78CDD08b4880d));
    }
    // era sepolia testnet
    if (block.chainid == 300) {
      return ITimestampAsserter(address(0xa64EC71Ee812ac62923c85cf0796aA58573c4Cf3));
    }
    // anvil-zksync (era-test-node)
    if (block.chainid == 260) {
      return ITimestampAsserter(address(0x0000000000000000000000000000000000808012));
    }
    revert Errors.NO_TIMESTAMP_ASSERTER(block.chainid);
  }
}
