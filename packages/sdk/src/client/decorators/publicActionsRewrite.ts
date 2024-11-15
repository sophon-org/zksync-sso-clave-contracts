import type { Account, Chain, Hex, PublicActions, Transport } from "viem";
import { estimateContractGas, estimateGas, prepareTransactionRequest } from "viem/actions";

import { type ClientWithZksyncAccountSessionData, signSessionTransaction } from "../clients/session.js";

const emptySignature = "0x" + "1b".padStart(65 * 2, "0") as Hex;

export function publicActionsRewrite<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(
  client: ClientWithZksyncAccountSessionData<transport, chain, account>,
): Pick<PublicActions<transport, chain, account>, "estimateContractGas" | "estimateGas" | "prepareTransactionRequest"> {
  return {
    prepareTransactionRequest: async (args) => {
      console.log("prepareTransactionRequest", args);
      if (!("customSignature" in args)) {
        (args as any).customSignature = signSessionTransaction({
          sessionKeySignedHash: emptySignature,
          sessionContract: client.contracts.session,
          sessionConfig: client.sessionConfig,
        });
      }
      console.log("Initial args", args);
      const request = await prepareTransactionRequest(client as any, {
        ...args,
        type: "eip712",
        // typeHex: "0x71",
        chainId: client.chain.id,
        parameters: ["gas", "nonce", "fees"],
        /* gasPrice: await getGasPrice(client),
        gas: await estimateGas(client, args as any), */
      } as any) as any;
      console.log("After prepare", request);
      return request;
    },
    estimateContractGas: (args) => {
      console.log("estimateContractGas", args);
      if (!("customSignature" in args)) {
        (args as any).customSignature = signSessionTransaction({
          sessionKeySignedHash: emptySignature,
          sessionContract: client.contracts.session,
          sessionConfig: client.sessionConfig,
        });
      }
      return estimateContractGas(client, args as any);
    },
    estimateGas: async (args) => {
      console.log("estimateGas", args);
      if (!("customSignature" in args)) {
        (args as any).customSignature = signSessionTransaction({
          sessionKeySignedHash: emptySignature,
          sessionContract: client.contracts.session,
          sessionConfig: client.sessionConfig,
        });
      }
      const estimated = await estimateGas(client, args);
      console.log("Estimated", estimated);
      return estimated;
    },
  };
}
