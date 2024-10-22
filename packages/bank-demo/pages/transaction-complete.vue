<template>
  <div class="pt-12">
    <div class="flex text-center items-center flex-col mb-8">
      <div
        class="bg-green-500 text-neutral-700 dark:text-neutral-300 dark:bg-neutral-800 w-[44px] h-[44px] p-2 rounded-full text-center mb-8"
        >
          <ZkIcon icon="check" :ui="'text-white'"/>
        </div>
      <h1 class="text-4xl font-bold">Transaction finished</h1>
    </div>
    <LayoutCard class="w-full">
      <div class="flex">
        <span class="font-bold text-left grow">From</span>
        <span>Your exchange account</span>
      </div>
      <div class="flex">
        <span class="font-bold grow">To</span>
        <span>Your crypto account</span>
      </div>
      <hr class="block mt-4 mb-4">
      <div class="flex">
        <span class="grow">Amount</span>
        <span>
          300 USDC
          <TokenUsdc class="inline"/>
        </span>
      </div>
      <div class="flex">
        <span class="grow">Fee</span>
        <span>0.00</span>
      </div>
    </LayoutCard>

    <div class="pb-18 text-center mt-8">
      <ZkLink type="primary" href="/">Close</ZkLink>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
