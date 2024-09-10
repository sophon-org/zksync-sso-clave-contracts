import { zeroAddress, decodeEventLog, decodeAbiParameters, encodeAbiParameters, type Prettify, type Account, type Address, type Chain, type Client, type Hash, type TransactionReceipt, type Transport } from 'viem'
import { waitForTransactionReceipt, writeContract } from 'viem/actions';

import { FactoryAbi } from '../../abi/Factory.js';
import { getPublicKeyBytesFromPasskeySignature } from '../../utils/passkey.js';

type DeployAccountArgs = {
  factory: Address;
  accountImplementation: Address;
  validator: Address;
  salt: Uint8Array; // Random 32 bytes
  passkeyBytes: Uint8Array; // Passkey signature
  initialModule: Address; // Passkey module address, or some other module
  initialModuleData?: Hash; // ABI-encoded data for initial module
  initialSpendLimit?: { // Initial spend limit if using Passkey module as initialModule
    sessionPublicKey: Address;
    token: Address;
    amount: number;
  }[];
};
type DeployAccountReturnType = {
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
  if (args.initialSpendLimit?.length) {
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
  
  const transactionHash = await writeContract(client, {
    address: args.factory,
    abi: FactoryAbi,
    functionName: "deployProxy7579Account",
    args: [
      args.salt,
      args.accountImplementation,
      await getPublicKeyBytesFromPasskeySignature(args.passkeyBytes),
      args.validator,
      args.initialModule,
      args.initialModuleData || "0x",
    ],
  } as any);
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
