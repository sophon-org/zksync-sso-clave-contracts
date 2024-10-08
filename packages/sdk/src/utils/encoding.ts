import { type Address, encodeAbiParameters, type Hash, parseAbiParameters, toHex } from "viem";

import type { SessionData } from "../client-gateway/interface.js";

export const encodeSessionSpendLimitParameters = (sessions: SessionData[]) => {
  const spendLimitTypes = [
    { type: "address", name: "tokenAddress" },
    { type: "uint256", name: "limit" },
  ] as const;

  const sessionKeyTypes = [
    { type: "address", name: "sessionKey" },
    { type: "uint256", name: "expiresAt" },
    { type: "tuple[]", name: "spendLimits", components: spendLimitTypes },
  ] as const;

  return encodeAbiParameters(
    [{ type: "tuple[]", components: sessionKeyTypes }],
    [
      sessions.map((sessionData) => ({
        sessionKey: sessionData.sessionKey,
        expiresAt: BigInt(Math.floor(new Date(sessionData.expiresAt).getTime() / 1000)),
        spendLimits: Object.entries(sessionData.spendLimit).map(([tokenAddress, limit]) => ({
          tokenAddress: tokenAddress as Address,
          limit: BigInt(limit),
        })),
      })),
    ],
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
