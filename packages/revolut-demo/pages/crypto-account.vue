<template>
  <div>
    <LayoutHeader>
      Home
      <template #aside>
        <ZkButton type="primary">Add crypto account</ZkButton>
      </template>
    </LayoutHeader>
    <div class="flex gap-4 mb-4">
      <AppNavButton href="/">Exchange account</AppNavButton>
      <AppNavButton href="/crypto-account">Crypto account</AppNavButton>
    </div>

    <LayoutCard class="mb-8">
      <h2 class="text-2xl text-center">Create on-chain account</h2>
      <p class="mt-4 font-light text-center">
        Add your self-custodial account using Passkeys and hold your assets in a truly decentralized way with the support of your favorite financial application. Your keys, your tokens.
      </p>
      <div class="flex justify-center mt-4">
        <ZkButton>Add crypto account</ZkButton>
      </div>
    </LayoutCard>

    <div class="flex flex-col justify-center items-center mb-8">
      <div
      class="bg-green-500 text-neutral-700 dark:text-neutral-300 dark:bg-neutral-800 w-[44px] h-[44px] p-2 rounded-full text-center"
      >
        <ZkIcon icon="check" :ui="'text-white'"/>
      </div>
      <p class="text-lg text-neutral-700">On-chain account created.</p>
      <p class="text-lg text-neutral-700">Transfer from the exchange account.</p>
    </div>

    <LayoutCard class="mb-8">
      <div class="flex items-center">
        <p class="grow">From exchange account</p>
        <ZkInput placeholder="0" :ui="{input:'text-right'}"/>
      </div>
      <div class="flex">
        <ZkDropdown :menu="cryptoList" align="start" type="ghost" @select="selectSymbol">
          <div class="flex items-center gap-1 text-neutral-800">
            <TokenUsdc :height="24"/> <span>USDC</span>
          </div>
        </ZkDropdown>
      </div>
    </LayoutCard>

    <LayoutCard class="mb-8">
      <div class="flex">
        <p class="grow">To Crypto account</p>
        <p>Balance: 0 USDC</p>
      </div>
    </LayoutCard>

    <div class="pb-20 text-center">
      <ZkButton type="primary">Transfer</ZkButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const cryptoList = [
  {
    value: "usdc",
    label: "USDC",
  },
  {
    value: "eth",
    label: "ETH"
  }
];

const selectSymbol = (e) => {
  console.log(e);
};
</script>
