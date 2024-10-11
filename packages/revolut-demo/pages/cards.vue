<template>
  <div class="pb-24">
    <LayoutHeader>
      Home
    </LayoutHeader>
    <div class="flex gap-4 mb-4">
      <AppNavButton href="/">Accounts</AppNavButton>
      <AppNavButton href="/cards">Cards</AppNavButton>
      <AppNavButton href="/crypto-account" v-if="appMeta.cryptoAccountAddress">Crypto Account</AppNavButton>
      <AddCryptoButton v-else></AddCryptoButton>
    </div>

    <LayoutCard class="mb-8">
      <div class="flex">
        <div class="grow">
          <p class="text-2xl font-medium text-neutral-400">None</p>
        </div>
        <div>
          <ZkIcon icon="credit_card" class="text-neutral-400" />
        </div>
      </div>
    </LayoutCard>

  </div>
</template>

<script setup lang="ts">
import AddCryptoButton from '~/components/app/AddCryptoButton.vue';

const { appMeta } = useAppMeta();
</script>
