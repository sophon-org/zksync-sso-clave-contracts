import { type Address, encodeAbiParameters, encodeFunctionData, type Hash, parseAbiParameters, toHex } from "viem";

import { SessionKeyModuleAbi } from "../abi/SessionKeyModule.js";
import type { SessionConfig } from "../utils/session.js";
import { SessionSpec } from "./session.js";

export const encodeSession = (sessionConfig: SessionConfig) => {
  const callData = encodeFunctionData({
    abi: SessionKeyModuleAbi,
    functionName: "createSession",
    args: [sessionConfig],
  });
  console.log("Equal", callData === encodeAbiParameters([SessionSpec], [sessionConfig]));
  return encodeAbiParameters([SessionSpec], [sessionConfig]);
};

export const encodePasskeyModuleParameters = (passkey: { passkeyPublicKey: [Buffer, Buffer]; expectedOrigin: string }) => {
  return encodeAbiParameters(
    [
      { type: "bytes32[2]", name: "xyPublicKeys" },
      { type: "string", name: "expectedOrigin" },
    ],
    [
      [toHex(passkey.passkeyPublicKey[0]), toHex(passkey.passkeyPublicKey[1])],
      passkey.expectedOrigin,
    ],
  );
};

export const encodeModuleData = (moduleData: { address: Address; parameters: Hash }) => {
  const moduleParams = parseAbiParameters("address, bytes");
  return encodeAbiParameters(
    moduleParams,
    [moduleData.address, moduleData.parameters],
  );
};
