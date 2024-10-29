<template>
  <div class="h-full flex justify-center flex-col p-4">
    <div>
      <BlurFade
        in-view
        :delay="0"
        class="block"
      >
        <span class="text-[45px] font-bold tracking-tighter dark:text-white leading-1">
          Mint your NFT.&nbsp;
        </span>
      </BlurFade>

      <BlurFade
        in-view
        :delay="650"
        class="inline"
      >
        <span class="text-[45px] font-bold tracking-tighter leading-1 text-blue-600">
          For free.
        </span>
      </BlurFade>
    </div>
    <BlurFade
      in-view
      :delay="650"
      class="inline"
    >
      <p class="mt-8 text-neutral-400 max-w-prose">
        Your authorized session for the NFT quest is now active! You can mint your NFT without any additional transaction approvals.
      </p>
      <p class="mt-8 text-neutral-400 max-w-prose">
        Also, it's free. ZKsync SSO leverages paymasters to enable app developers to choose a custom gas token or even entirely sponsor gas fees for their users.
      </p>
      <ZkButton
        type="primary"
        class="uppercase mt-8"
        @click="mintNFT"
      >
        Mint 100% free NFT
      </ZkButton>
    </BlurFade>
  </div>
</template>

<script setup lang="ts">
import { waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address } from "viem";
import { getGeneralPaymasterInput } from "viem/zksync";

import { supportedChains, useConnectorStore, wagmiConfig } from "~/stores/connector";
import { nftAbi } from "~/utils/abi";

const runtimeConfig = useRuntimeConfig();

const mintNFT = async () => {
  const { account } = storeToRefs(useConnectorStore());

  const transactionHash = await writeContract(wagmiConfig, {
    account: account.value.address,
    address: runtimeConfig.public.contracts.nft as Address,
    abi: nftAbi,
    functionName: "mint",
    args: [account.value.address as Address],
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

  await waitForReceipt().then((trxn) => {
    console.log("NFT minted successfully", trxn);
    navigateTo("/mint/share");
  }).catch(() => {
    console.log("NFT minting failed");
  });
};
</script>
