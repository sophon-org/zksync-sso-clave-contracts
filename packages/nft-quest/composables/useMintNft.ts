import { estimateGas, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { type Address, encodeFunctionData } from "viem";
import { getGeneralPaymasterInput } from "viem/zksync";

import { supportedChains, wagmiConfig } from "~/stores/connector";

export const useMintNft = async (_address: MaybeRef<Address>) => {
  const address = toRef(_address);

  return await useAsyncData("mintZeek", async () => {
    const runtimeConfig = useRuntimeConfig();
    const { account } = storeToRefs(useConnectorStore());

    const mintingForAddress = address.value || account.value.address;

    const data = encodeFunctionData({
      abi: nftAbi,
      functionName: "mint",
      args: [mintingForAddress],
    });

    const estimatedGas = await estimateGas(wagmiConfig, {
      account: account.value.address,
      to: runtimeConfig.public.contracts.nft as Address,
      chainId: supportedChains[0].id,
      data,
    });

    const transactionHash = await writeContract(wagmiConfig, {
      account: account.value.address,
      address: runtimeConfig.public.contracts.nft as Address,
      abi: nftAbi,
      functionName: "mint",
      args: [mintingForAddress],
      gas: estimatedGas,
      chainId: supportedChains[0].id,
      paymaster: runtimeConfig.public.contracts.paymaster as Address,
      paymasterInput: getGeneralPaymasterInput({ innerInput: new Uint8Array() }),
    });

    const waitForReceipt = async () => {
      console.log("TRANSACTION HASH", transactionHash.value);
      try {
        const transactionReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: transactionHash.value });
        return transactionReceipt;
      } catch (error) {
        if (error instanceof Error && (error.message.includes("The Transaction may not be processed on a block yet") || error.message.includes("Cannot convert null to a BigInt"))) {
          console.log(error.message);
          await new Promise((resolve) => setTimeout(resolve, 500));
          return await waitForReceipt();
        }
        throw error;
      }
    };

    const trxnReceipt = await waitForReceipt();

    return trxnReceipt;
  }, {
    server: false,
    immediate: false,
  });
};
