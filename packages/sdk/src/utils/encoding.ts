import { type Address, encodeAbiParameters, type Hash, parseAbiParameters, toHex } from "viem";

import type { SessionData } from "../client-gateway/interface.js";
import { getSession } from "../utils/session.js";

export const encodeCreateSessionParameters = (session: SessionData) => {
  const sessionSpec = {
        components: [
          {
            internalType: "address",
            name: "signer",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "expiry",
            type: "uint256",
          },
          {
            components: [
              {
                internalType: "enum SessionLib.LimitType",
                name: "limitType",
                type: "uint8",
              },
              {
                internalType: "uint256",
                name: "limit",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "period",
                type: "uint256",
              },
            ],
            internalType: "struct SessionLib.UsageLimit",
            name: "feeLimit",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "address",
                name: "target",
                type: "address",
              },
              {
                internalType: "bytes4",
                name: "selector",
                type: "bytes4",
              },
              {
                internalType: "uint256",
                name: "maxValuePerUse",
                type: "uint256",
              },
              {
                components: [
                  {
                    internalType: "enum SessionLib.LimitType",
                    name: "limitType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "limit",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "period",
                    type: "uint256",
                  },
                ],
                internalType: "struct SessionLib.UsageLimit",
                name: "valueLimit",
                type: "tuple",
              },
              {
                components: [
                  {
                    internalType: "enum SessionLib.Condition",
                    name: "condition",
                    type: "uint8",
                  },
                  {
                    internalType: "uint64",
                    name: "index",
                    type: "uint64",
                  },
                  {
                    internalType: "bytes32",
                    name: "refValue",
                    type: "bytes32",
                  },
                  {
                    components: [
                      {
                        internalType: "enum SessionLib.LimitType",
                        name: "limitType",
                        type: "uint8",
                      },
                      {
                        internalType: "uint256",
                        name: "limit",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "period",
                        type: "uint256",
                      },
                    ],
                    internalType: "struct SessionLib.UsageLimit",
                    name: "limit",
                    type: "tuple",
                  },
                ],
                internalType: "struct SessionLib.Constraint[]",
                name: "constraints",
                type: "tuple[]",
              },
            ],
            internalType: "struct SessionLib.CallSpec[]",
            name: "callPolicies",
            type: "tuple[]",
          },
          {
            components: [
              {
                internalType: "address",
                name: "target",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "maxValuePerUse",
                type: "uint256",
              },
              {
                components: [
                  {
                    internalType: "enum SessionLib.LimitType",
                    name: "limitType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "limit",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "period",
                    type: "uint256",
                  },
                ],
                internalType: "struct SessionLib.UsageLimit",
                name: "valueLimit",
                type: "tuple",
              },
            ],
            internalType: "struct SessionLib.TransferSpec[]",
            name: "transferPolicies",
            type: "tuple[]",
          },
        ],
        internalType: "struct SessionLib.SessionSpec",
        name: "newSession",
        type: "tuple",
      };

  return encodeAbiParameters(
    [sessionSpec],
    [{ ...getSession(session), signer: session.sessionKey }],
  );
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
