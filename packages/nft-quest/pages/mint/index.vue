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
import { writeContract } from "@wagmi/core";
import type { Address } from "viem";
import { getGeneralPaymasterInput } from "viem/zksync";

import { useConnectorStore, wagmiConfig } from "~/stores/connector";

const runtimeConfig = useRuntimeConfig();

const mintNFT = async () => {
  const { account } = storeToRefs(useConnectorStore());

  const hash = await writeContract(wagmiConfig, {
    account: account.value.address,
    address: runtimeConfig.public.contracts.nft as Address,
    abi: [{ inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
    ],
    name: "mint",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ] as const,
    stateMutability: "nonpayable",
    type: "function" }],
    functionName: "mint",
    args: [account.value.address as Address],
    paymaster: runtimeConfig.public.contracts.paymaster,
    paymasterInput: getGeneralPaymasterInput({ innerInput: new Uint8Array() }),
  });

  console.log("minted NFT", hash);
  // navigateTo("/mint/share");
};
</script>
