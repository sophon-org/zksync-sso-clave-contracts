import { type Account, type Address, type Chain, type Client, type ExtractChainFormatterReturnType, type Hash, type Prettify, type TransactionReceipt, type Transport } from 'viem'
import { readContract, waitForTransactionReceipt, writeContract } from 'viem/actions';
import { generatePrivateKey, publicKeyToAddress } from 'viem/accounts';
import { type PublicKeyCredentialCreationOptionsJSON, type RegistrationResponseJSON, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";
import { startRegistration } from '@simplewebauthn/browser';
import { generateAuthenticationOptions, generateRegistrationOptions, type GenerateAuthenticationOptionsOpts, type GenerateRegistrationOptionsOpts } from '@simplewebauthn/server';

import type { ClientWithZksyncAccountData } from '../createWalletClient.js';
import type { SessionPreferences } from '../../client-gateway/interface.js';

export type ZksyncAccountSessionActions<chain extends Chain> = {
  // requestPasskeySignature: (args: RequestPasskeySignatureArgs) => Promise<RequestPasskeySignatureReturnType>;
  requestSession: (args: RequestSessionArgs) => Promise<RequestSessionReturnType<chain>>;
  getTokenSpendLimit: (args: GetTokenSpendLimitArgs) => Promise<GetTokenSpendLimitReturnType>;
};

export function zksyncAccountSessionActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(client: ClientWithZksyncAccountData<transport, chain, account>): ZksyncAccountSessionActions<chain> {
  return {
    // requestPasskeySignature: async (args: RequestPasskeySignatureArgs) => requestPasskeySignature(client, args),
    requestSession: async (args: RequestSessionArgs) => {
      const response = await requestSession(client, {
        spendLimit: args.spendLimit,
        validUntil: args.validUntil,
        sessionKey: args.sessionKey || client.sessionKey,
        contracts: client.contracts,
      });
      if (args.updateClientSessionKey !== false) client.sessionKey = response.sessionKey;
      return response;
    },
    getTokenSpendLimit: async (tokenAddress: GetTokenSpendLimitArgs) => {
      if (!client.sessionKey) throw new Error("Session key not set");
      return await getTokenSpendLimit(client, {
        tokenAddress,
        sessionKey: client.sessionKey,
        contracts: client.contracts,
      });
    },
  }
}

type GeneratePasskeyRegistrationOptionsArgs = Partial<GenerateRegistrationOptionsOpts> & { userName: string; userDisplayName: string };
export const generatePasskeyRegistrationOptions = async (args: GeneratePasskeyRegistrationOptionsArgs): Promise<PublicKeyCredentialCreationOptionsJSON> => {
  let rpName: string = args.rpName || "";
  let rpID: string = args.rpID || "";
  try {
    rpName = window.location.hostname;
    rpID = window.location.host;
  } catch {
    // ignore
  }
  if (!rpName || !rpID) throw new Error("Can't set rpName and rpID automatically, please provide them manually in the arguments");

  const defaultOptions: GenerateRegistrationOptionsOpts = {
    rpName,
    rpID,
    userName: args.userName,
    userDisplayName: args.userDisplayName,
    // We want a stable id for the passkey
    attestationType: 'direct',
    // Not preventing users from re-registering existing authenticators
    excludeCredentials: [],
    // See "Guiding use of authenticators via authenticatorSelection" below
    authenticatorSelection: {
      residentKey: 'required',
    },
  };
  const params: GenerateRegistrationOptionsOpts = Object.assign({}, defaultOptions, args)
  const options = await generateRegistrationOptions(params);
  options.pubKeyCredParams = options.pubKeyCredParams.filter(
    (creds) => creds.alg == 1,
  );

  return options;
}

type GeneratePasskeyAuthenticationOptionsArgs = Partial<GenerateAuthenticationOptionsOpts>
export const generatePasskeyAuthenticationOptions = async (args: GeneratePasskeyAuthenticationOptionsArgs): Promise<PublicKeyCredentialRequestOptionsJSON> => {
  let rpID: string = args.rpID || "";
  try {
    rpID = window.location.host;
  } catch {
    // ignore
  }
  if (!rpID) throw new Error("Can't set rpID automatically, please provide them manually in the arguments");

  const defaultOptions: GenerateAuthenticationOptionsOpts = {
    rpID: rpID,
  };
  const params: GenerateAuthenticationOptionsOpts = Object.assign({}, defaultOptions, args)
  const options = await generateAuthenticationOptions(params);
  options.challenge = options.challenge.slice(0, 32);
  if ('pubKeyCredParams' in options) {
    options.pubKeyCredParams = (
      options.pubKeyCredParams as Array<{ alg: number; type: string }>
    ).filter((creds) => creds.alg == -7);
  }

  return options;
}

type RequestPasskeySignatureReturnType = {
  passkeyRegistrationResponse: RegistrationResponseJSON;
  passkeyRegistrationOptions: PublicKeyCredentialCreationOptionsJSON;
}
type RequestPasskeySignatureArgs = { passkeyRegistrationOptions: PublicKeyCredentialCreationOptionsJSON } | GeneratePasskeyRegistrationOptionsArgs;
export const requestPasskeySignature = async (args: RequestPasskeySignatureArgs): Promise<RequestPasskeySignatureReturnType> => {
  const passkeyRegistrationOptions = 'passkeyRegistrationOptions' in args ? args.passkeyRegistrationOptions : await generatePasskeyRegistrationOptions(args);
  const registrationResponse: RegistrationResponseJSON = await startRegistration(passkeyRegistrationOptions);
  return {
    passkeyRegistrationResponse: registrationResponse,
    passkeyRegistrationOptions,
  };
}

type RequestSessionReturnType<chain extends Chain> = {
  transactionReceipt: ExtractChainFormatterReturnType<chain, "transactionReceipt", TransactionReceipt>;
  sessionKey: Hash;
}
type RequestSessionArgs = Prettify<SessionPreferences & {
  sessionKey?: Hash;
  /**
   * @default true
   * @description If true, client will be updated with the new session key after the transaction is confirmed
   */
  updateClientSessionKey?: boolean
}>;
export const requestSession = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account
>(client: Client<transport, chain, account>, args: Omit<RequestSessionArgs, 'updateClientSessionKey'> & { contracts: { session: Address } }): Promise<RequestSessionReturnType<chain>> => {
  const registrationResponse: RegistrationResponseJSON = await startRegistration(args);
  const sessionKey = args.sessionKey || generatePrivateKey();
  const sessionKeyPublicAddress = publicKeyToAddress(sessionKey);
  const transactionHash = await setSessionPasskey(client, {
    sessionKeyPublicAddress,
    passkeyRegistrationResponse: registrationResponse,
    contracts: args.contracts,
    spendLimit: args.spendLimit,
    validUntil: args.validUntil,
  });
  const receipt = await waitForTransactionReceipt(client, { hash: transactionHash });
  if (receipt.status === "reverted") throw new Error("Transaction reverted");
  return {
    transactionReceipt: receipt,
    sessionKey,
  };
}

type SetSessionPasskeyArgs = Prettify<SessionPreferences & {
  sessionKeyPublicAddress: Address;
  passkeyRegistrationResponse: RegistrationResponseJSON;
  contracts: { session: Address };
}>
export const setSessionPasskey = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account
>(client: Client<transport, chain, account>, args: SetSessionPasskeyArgs): Promise<Hash> => {
  /* TODO: Implement set session */
  const transactionHash = await writeContract(client, {
    address: args.contracts.session,
    args: [args.sessionKeyPublicAddress, args.passkeyRegistrationResponse, args.spendLimit, args.validUntil],
    abi: [] as const,
    functionName: "USE_ACTUAL_METHOD_HERE",
  } as any);
  return transactionHash;
}

type SetOwnerPasskeyArgs = {
  sessionKeyPublicAddress: Address;
  passkeyRegistrationResponse: RegistrationResponseJSON;
  contracts: { session: Address };
};
export const setOwnerPasskey = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account
>(client: Client<transport, chain, account>, args: SetOwnerPasskeyArgs): Promise<Hash> => {
  /* TODO: Implement set owner passkey */
  const transactionHash = await writeContract(client, {
    address: args.contracts.session,
    args: [args.sessionKeyPublicAddress, args.passkeyRegistrationResponse],
    abi: [] as const,
    functionName: "USE_ACTUAL_METHOD_HERE",
  } as any);
  return transactionHash;
}

type GetTokenSpendLimitReturnType = bigint;
type GetTokenSpendLimitArgs = Address;
export const getTokenSpendLimit = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account
>(client: Client<transport, chain, account>, args: { tokenAddress: Address; contracts: { session: Address } } & ({ sessionKey: Hash } | { sessionKeyPublicAddress: Address })): Promise<GetTokenSpendLimitReturnType> => {
  const sessionKeyPublicAddress = 'sessionKey' in args ? publicKeyToAddress(args.sessionKey) : args.sessionKeyPublicAddress;
  /* TODO: use actual contract abi and method */
  const spendLimit = await readContract(client, {
    address: args.contracts.session,
    args: [sessionKeyPublicAddress, args.tokenAddress],
    abi: [] as const,
    functionName: "USE_ACTUAL_METHOD_HERE",
  });
  return spendLimit;
}
