import { type Account, type Chain, type Transport } from "viem";

// import { getRemainingTokenSpendLimit, type GetRemainingTokenSpendLimitReturnType } from "../actions/session.js";
import type { ClientWithZksyncAccountSessionData } from "../clients/session.js";

/* eslint-disable @typescript-eslint/no-empty-object-type */
export type ZksyncAccountSessionActions = {
  // getRemainingTokenSpendLimit: (tokenAddress: Address) => Promise<GetRemainingTokenSpendLimitReturnType>;
};

export function zksyncAccountSessionActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
  /* eslint-disable @typescript-eslint/no-unused-vars */
>(client: ClientWithZksyncAccountSessionData<transport, chain, account>): ZksyncAccountSessionActions {
  return {
    // getRemainingTokenSpendLimit: async (tokenAddress: Address) => {
    //   if (!client.sessionKey) throw new Error("Session key not set");
    //   return await getRemainingTokenSpendLimit(client, {
    //     tokenAddress,
    //     sessionKey: client.sessionKey,
    //     contracts: client.contracts,
    //   });
    // },
  };
}
