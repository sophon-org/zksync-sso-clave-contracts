import { type Account, type Chain, type Transport } from "viem";

import {
  setSessionKey, type SetSessionKeyArgs, type SetSessionKeyReturnType,
  setSessionKeys, type SetSessionKeysArgs, type SetSessionKeysReturnType,
} from "../actions/session.js";
import type { ClientWithZksyncAccountSessionData } from "../clients/session.js";

export type ZksyncAccountPasskeyActions = {
  setSessionKeys: (args: Omit<SetSessionKeysArgs, "contracts">) => Promise<SetSessionKeysReturnType>;
  setSessionKey: (args: Omit<SetSessionKeyArgs, "contracts">) => Promise<SetSessionKeyReturnType>;
};

export function zksyncAccountPasskeyActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(client: ClientWithZksyncAccountSessionData<transport, chain, account>): ZksyncAccountPasskeyActions {
  return {
    setSessionKeys: async (args: Omit<SetSessionKeysArgs, "contracts">) => {
      return await setSessionKeys(client, {
        ...args,
        contracts: client.contracts,
      });
    },
    setSessionKey: async (args: Omit<SetSessionKeyArgs, "contracts">) => {
      return await setSessionKey(client, {
        ...args,
        contracts: client.contracts,
      });
    },
  };
}
