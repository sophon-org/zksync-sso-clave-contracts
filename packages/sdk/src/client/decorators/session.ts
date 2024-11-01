import { type Account, type Chain, type Transport } from "viem";

import type { ClientWithZksyncAccountSessionData } from "../clients/session.js";

/* eslint-disable @typescript-eslint/no-empty-object-type */
export type ZksyncAccountSessionActions = {
};

export function zksyncAccountSessionActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
  /* eslint-disable @typescript-eslint/no-unused-vars */
>(client: ClientWithZksyncAccountSessionData<transport, chain, account>): ZksyncAccountSessionActions {
  return {
  };
}
