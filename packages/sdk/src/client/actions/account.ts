import { zeroAddress, decodeEventLog, decodeAbiParameters, encodeAbiParameters, type Prettify, type Account, type Address, type Chain, type Client, type Hash, type TransactionReceipt, type Transport } from 'viem'
import { waitForTransactionReceipt, writeContract } from 'viem/actions';

import { FactoryAbi } from '../../abi/Factory.js';
import { getPublicKeyBytesFromPasskeySignature } from '../../utils/passkey.js';
import { requestPasskeySignature, type RequestPasskeySignatureArgs } from './passkey.js';

/* TODO: try to get rid of most of the contract params like accountImplementation, validator, initialModule */
/* it should come from factory, not passed manually each time */
export type DeployAccountArgs = {
  factory: Address;
  accountImplementation: Address;
  validator: Address;
  salt?: Uint8Array; // Random 32 bytes
  passkey: {
    passkeySignature: Uint8Array;
  } | RequestPasskeySignatureArgs,
  initialModule: Address; // Passkey module address, or some other module
  initialModuleData?: Hash; // ABI-encoded data for initial module
  initialSpendLimit?: { // Initial spend limit if using Passkey module as initialModule
    sessionPublicKey: Address;
    token: Address;
    amount: number;
  }[];
  onTransactionSent?: (hash: Hash) => void;
};
export type DeployAccountReturnType = {
  address: Address;
  transactionReceipt: TransactionReceipt;
};
export const deployAccount = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account
>(client: Client<transport, chain, account>, args: Prettify<DeployAccountArgs>): Promise<DeployAccountReturnType> => {
  if (args.initialModuleData && args.initialSpendLimit?.length) {
    throw new Error("Either initialModuleData or initialSpendLimit can be provided, not both");
  }

  /* Format spendlimit to initialModuleData if initialSpendLimit was provided */
  if (args.initialSpendLimit?.length) {
    /* TODO: why is it missing session time limit? */
    const tokenConfigTypes = [
      { type: 'address', name: 'token' },
      { type: 'address', name: 'sessionPublicKey' },
      { type: 'uint256', name: 'limit' }
    ] as const;
    args.initialModuleData = encodeAbiParameters(
      [{ type: 'tuple[]', components: tokenConfigTypes }], 
      [
        args.initialSpendLimit.map(({ token, sessionPublicKey, amount }) => ({
          token,
          sessionPublicKey,
          limit: BigInt(amount)
        }))
      ]
    )
  }

  if (!args.salt) {
    args.salt = crypto.getRandomValues(new Uint8Array(32));
  }

  /* Request signature via webauthn if signature not provided */
  let passkeySignature: Uint8Array;
  if ('passkeySignature' in args.passkey) {
    passkeySignature = args.passkey.passkeySignature;
  } else {
    passkeySignature = (await requestPasskeySignature(args.passkey)).passkeyPublicKey;
  }

  const passkeyPublicKey = await getPublicKeyBytesFromPasskeySignature(passkeySignature);
  
  const transactionHash = await writeContract(client, {
    address: args.factory,
    abi: FactoryAbi,
    functionName: "deployProxy7579Account",
    args: [
      args.salt,
      args.accountImplementation,
      passkeyPublicKey,
      args.validator,
      args.initialModule,
      args.initialModuleData || "0x",
    ],
  } as any);
  if (args.onTransactionSent) {
    try { args.onTransactionSent(transactionHash) }
    catch {}
  }
  const transactionReceipt = await waitForTransactionReceipt(client, { hash: transactionHash });
  
  /* TODO: use or remove this */
  console.debug("Figure out if we can get address properly from this data", decodeEventLog({
    abi: FactoryAbi,
    data: transactionReceipt.logs[0].data,
    topics: transactionReceipt.logs[0].topics,
  }));

  const proxyAccountAddress = decodeAbiParameters(
    [{ type: 'address', name: 'accountAddress' }],
    transactionReceipt.logs[0].data
  )[0];

  /* TODO: figure out if this check is really needed, most likely not */
  if (proxyAccountAddress === zeroAddress) {
    throw new Error("Received zero address from account deployment");
  }

  return {
    address: proxyAccountAddress,
    transactionReceipt: transactionReceipt
  };
}
