import { type Account, type Address, type Chain, type Client, type Hash, type Transport } from 'viem'
import { writeContract } from 'viem/actions';
import { type PublicKeyCredentialCreationOptionsJSON, type RegistrationResponseJSON, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";
import { startRegistration } from '@simplewebauthn/browser';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyRegistrationResponse, type GenerateAuthenticationOptionsOpts, type GenerateRegistrationOptionsOpts } from '@simplewebauthn/server';

export type GeneratePasskeyRegistrationOptionsArgs = Partial<GenerateRegistrationOptionsOpts> & { userName: string; userDisplayName: string };
export type GeneratePasskeyRegistrationOptionsReturnType = PublicKeyCredentialCreationOptionsJSON;
export const generatePasskeyRegistrationOptions = async (args: GeneratePasskeyRegistrationOptionsArgs): Promise<GeneratePasskeyRegistrationOptionsReturnType> => {
  let rpName: string = args.rpName || "";
  let rpID: string = args.rpID || "";
  try {
    rpName = window.location.hostname;
    rpID = window.location.hostname;
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

export type GeneratePasskeyAuthenticationOptionsArgs = Partial<GenerateAuthenticationOptionsOpts>;
export type GeneratePasskeyAuthenticationOptionsReturnType = PublicKeyCredentialRequestOptionsJSON;
export const generatePasskeyAuthenticationOptions = async (args: GeneratePasskeyAuthenticationOptionsArgs): Promise<GeneratePasskeyAuthenticationOptionsReturnType> => {
  let rpID: string = args.rpID || "";
  try {
    rpID = window.location.hostname;
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

export type RequestPasskeySignatureArgs = { passkeyRegistrationOptions: PublicKeyCredentialCreationOptionsJSON } | GeneratePasskeyRegistrationOptionsArgs;
export type RequestPasskeySignatureReturnType = {
  passkeyRegistrationResponse: RegistrationResponseJSON;
  passkeyRegistrationOptions: PublicKeyCredentialCreationOptionsJSON;
  passkeyPublicKey: Uint8Array;
}
export const requestPasskeySignature = async (args: RequestPasskeySignatureArgs): Promise<RequestPasskeySignatureReturnType> => {
  const passkeyRegistrationOptions = 'passkeyRegistrationOptions' in args ? args.passkeyRegistrationOptions : await generatePasskeyRegistrationOptions(args);
  const registrationResponse: RegistrationResponseJSON = await startRegistration(passkeyRegistrationOptions);
  const verification = await verifyRegistrationResponse({
    response: registrationResponse,
    expectedChallenge: passkeyRegistrationOptions.challenge,
    expectedOrigin: window.location.origin,
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error("Passkey validation failed"); 
  return {
    passkeyRegistrationResponse: registrationResponse,
    passkeyRegistrationOptions,
    passkeyPublicKey: verification.registrationInfo.credentialPublicKey,
  };
}

export type AddAccountOwnerPasskeyArgs = {
  passkeyPublicKey: Uint8Array;
  contracts: { session: Address };
};
export type AddAccountOwnerPasskeyReturnType = Hash;
export const addAccountOwnerPasskey = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account
>(client: Client<transport, chain, account>, args: AddAccountOwnerPasskeyArgs): Promise<AddAccountOwnerPasskeyReturnType> => {
  /* TODO: Implement set owner passkey */
  const transactionHash = await writeContract(client, {
    address: args.contracts.session,
    args: [args.passkeyPublicKey],
    abi: [] as const,
    functionName: "USE_ACTUAL_METHOD_HERE",
  } as any);
  return transactionHash;
}
