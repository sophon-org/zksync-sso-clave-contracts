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
        <div class="grow mb-4">
          <p class="text-4xl font-bold" v-if="!appMeta.hasCompletedInitialTransfer">£ 2,000</p>
          <p class="text-4xl font-bold" v-else>£213.21</p>
          <p class="text-lg font-medium text-neutral-400">British Pound</p>
        </div>
        <div>
          <TokenGbp :height="48"/>
        </div>
      </div>
      <div class="flex gap-2">

        <ZkButton type="secondary">
          <template #prefix>
            <ZkIcon icon="add" />
          </template>
          Add money
        </ZkButton>

        <ZkButton type="secondary">
          <template #prefix>
            <ZkIcon icon="arrow_forward" />
          </template>
          Send
        </ZkButton>

        <ZkButton type="secondary">
          <template #prefix>
            <ZkIcon icon="info" />
          </template>
          Account details
        </ZkButton>

        <ZkButtonIcon type="secondary" icon="more_horiz"/>
      </div>

      <p class="mt-6 text-neutral-500">Transactions</p>
      <div class="flex gap-2 mt-6" v-if="appMeta.hasCompletedInitialTransfer">
        <ZkIconThumbnail icon="currency_bitcoin" />
        <div class="grow">
          <p>www.revolut.com/*London</p>
          <p class="text-sm text-neutral-600">Pending - A few minutes ago</p>
        </div>
        <div class="text-2xl font-light text-neutral-600">
          - £1,786.79
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <ZkIconThumbnail icon="add" />
        <div class="grow">
          <p>OBA topup from N Villanueva</p>
          <p class="text-sm text-neutral-600">4 Oct, 13:32 - OBAGNSGT3OXBB4433</p>
        </div>
        <div class="text-2xl font-light">
          + £2,000.00
        </div>
      </div>
    </LayoutCard>

    <!-- <h2 class="mb-4 font-semibold text-neutral-600">Assets</h2>

    <LayoutCard class="flex gap-2 items-center mb-8">
      <TokenUsdc :height="48" />
      <div class="flex flex-col">
        <span>USDC</span>
        <span class="text-neutral-700 text-sm">USDC</span>
      </div>
      <span class="grow text-right">300</span>
    </LayoutCard>

    <h2 class="mb-4 font-semibold text-neutral-600">Applications</h2>

    <div>
      <div class="bg-primary-200 rounded-t-zk flex items-center justify-center gap-2 py-4">
        <img src="/aave-logo.png" class="rounded-lg h-[32px]"  >
        <span class="text-white">AAVE</span>
      </div>
      <div class="bg-white rounded-b-zk pt-4 px-8 pb-8">
        <ZkTabs
        :tabs="[
          { slot: 'tab1', label: 'Assets to supply' },
          { slot: 'tab2', label: 'Your supplies' },
        ]"
      >
        <template #tab1>
          <div class="flex gap-2">
            <TokenUsdc :height="48"/>
            <div class="grow flex justify-stretch">
              <div class="grow">
                <div>USDC</div>
                <div class="text-sm text-neutral-600">USDC</div>
              </div>
              <div class="grow">
                <div>0.97 %</div>
                <div class="text-sm text-neutral-600">APY</div>
              </div>
              <div class="grow">
                <div>YES</div>
                <div class="text-sm text-neutral-600">Can be collateral</div>
              </div>
            </div>
            <div class="flex gap-2">
              <ZkButton type="secondary">Supply</ZkButton>
              <ZkButtonIcon type="secondary" icon="more_horiz"/>
            </div>
          </div>
        </template>
        <template #tab2>
          Supplies
        </template>
      </ZkTabs>
      </div>
    </div> -->

  </div>
</template>

<script setup lang="ts">
import AddCryptoButton from '~/components/app/AddCryptoButton.vue';

const { appMeta } = useAppMeta();
</script>
