import { createClient, getAddress, publicActions, type Account, type Address, type Chain, type Client, type Hash, type Prettify, type PublicRpcSchema, type RpcSchema, type Transport, type WalletClientConfig, type WalletRpcSchema } from 'viem'
import { privateKeyToAccount } from 'viem/accounts';

import { zksyncAccountWalletActions, type ZksyncAccountWalletActions } from './decorators/wallet.js';
import { zksyncAccountSessionActions, type ZksyncAccountSessionActions } from './decorators/session.js';

export type ZksyncAccountContracts = {
  session: Address; // Session, spend limit, etc.
  accountFactory?: Address; // For account creation
}

type ZksyncAccountData = {
  sessionKey?: Hash;
  contracts: ZksyncAccountContracts;
}

export type ClientWithZksyncAccountData<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  account extends Account = Account,
> = Client<transport, chain, account> & ZksyncAccountData;

export type ZksyncAccountWalletClient<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
  account extends Account = Account,
> = Prettify<
  Client<
    transport,
    chain,
    account,
    rpcSchema extends RpcSchema
      ? [...PublicRpcSchema, ...WalletRpcSchema, ...rpcSchema]
      : [...PublicRpcSchema, ...WalletRpcSchema],
    ZksyncAccountWalletActions<chain, account> & ZksyncAccountSessionActions<chain>
  > & ZksyncAccountData
>

export interface ZksyncAccountWalletClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined
> extends Omit<WalletClientConfig<transport, chain, Account, rpcSchema>, 'account'> {
  chain: NonNullable<chain>;
  address: Address;
  sessionKey?: Hash;
  contracts: ZksyncAccountContracts;
  key?: string;
  name?: string;
}

export function createZksyncWalletClient<
  transport extends Transport,
  chain extends Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
>(_parameters: ZksyncAccountWalletClientConfig<transport, chain, rpcSchema>): ZksyncAccountWalletClient<transport, chain, rpcSchema> {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters['key']>;
    name: NonNullable<WalletClientParameters['name']>;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || 'wallet',
    name: _parameters.name || 'Wallet Client',
  };
  
  const account = parameters.sessionKey ? privateKeyToAccount(parameters.sessionKey) : parameters.address;
  const client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: 'walletClient',
  })
    .extend(() => ({
      sessionKey: parameters.sessionKey,
      contracts: parameters.contracts,
    }))
    .extend(publicActions)
    .extend(zksyncAccountWalletActions)
    .extend(zksyncAccountSessionActions);
  return client;
}