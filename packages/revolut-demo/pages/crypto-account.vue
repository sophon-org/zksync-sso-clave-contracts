<template>
  <div class="pb-24">
    <LayoutHeader>
      Home
    </LayoutHeader>
    <div class="flex gap-4 mb-4">
      <AppNavButton href="/">Accounts</AppNavButton>
      <AppNavButton href="/cards">Cards</AppNavButton>
      <AppNavButton href="/crypto-account">Crypto Account</AppNavButton>
    </div>

    <div class="flex flex-col justify-center items-center mb-6" v-if="!appMeta.hasCompletedInitialTransfer">
      <div class="bg-green-500 text-neutral-700 dark:text-neutral-300 dark:bg-neutral-800 w-[44px] h-[44px] p-2 rounded-full text-center">
        <ZkIcon icon="check" :ui="'text-white'"/>
      </div>
      <p class="text-lg text-neutral-700">Crypto account created.</p>
    </div>

    <LayoutCard class="flex gap-8 items-center justify-between mb-8 !py-2 !px-4" >
        <span class="text-l font-bold">Crypto Account Address</span>
        <div>
          <span>{{ appMeta.cryptoAccountAddress?.slice(0,5) + '...' + appMeta.cryptoAccountAddress?.slice(-3)  }}</span>
          <ZkCopy :content="appMeta.cryptoAccountAddress" />
        </div>
    </LayoutCard>

    <OnRampCrypto v-if="!appMeta.hasCompletedInitialTransfer"></OnRampCrypto>

    <LayoutCard class="mb-8" v-else>
      <div class="flex">
        <div class="grow mb-4">
          <p class="text-4xl font-bold">{{ (+formatEther(accountBalance)).toFixed(6) }} ETH</p>
          <p class="text-lg font-medium text-neutral-400">ZKsync</p>
        </div>
        <div>
          <TokenEth :height="48"/>
        </div>
      </div>
      <div class="flex gap-2">

        <ZkButton type="secondary">
          <template #prefix>
            <ZkIcon icon="add" />
          </template>
          Deposit
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
          info
        </ZkButton>

        <ZkButtonIcon type="secondary" icon="more_horiz"/>
      </div>

      <p class="mt-4 text-neutral-500">Transactions</p>
      <!-- <div class="flex gap-2 mt-4">
        <ZkIconThumbnail icon="add" />
        <div class="grow">
          <p>Received from john.eth</p>
          <p class="text-sm text-neutral-600">Just now</p>
        </div>
        <div class="text-2xl font-light">
          + 5.00 USDC
        </div>
      </div> -->
      <div class="flex gap-2 mt-4" v-if="appMeta.hasCompletedAaveStake">
        <ZkIconThumbnail icon="savings" />
        <div class="grow">
          <p>Staked on AAVE</p>
          <p class="text-sm text-neutral-600">Just now</p>
        </div>
        <div class="text-2xl font-light text-neutral-600">
          - 0.1000 ETH
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <ZkIconThumbnail icon="add" />
        <div class="grow">
          <p>Received from Main account</p>
          <p class="text-sm text-neutral-600">5 minutes ago</p>
        </div>
        <div class="text-2xl font-light">
          + 1.0000 ETH
        </div>
      </div>
    </LayoutCard>

    <!-- <h2 class="mb-4 font-semibold text-neutral-600" v-if="appMeta.hasCompletedInitialTransfer">Assets</h2> -->
    <!-- <LayoutCard class="flex gap-2 items-center mb-2 py-4">
      <TokenUsdc :height="48" />
      <div class="flex flex-col">
        <span>USDC</span>
        <span class="text-neutral-700 text-sm">ZKsync</span>
      </div>
      <span class="grow text-right">5 USDC</span>
    </LayoutCard> -->
    <!-- <LayoutCard class="flex gap-2 items-center mb-8 py-4" v-if="appMeta.hasCompletedInitialTransfer">
      <TokenEth :height="48" />
      <div class="flex flex-col">
        <span>ETH</span>
        <span class="text-neutral-700 text-sm">ZKsync</span>
      </div>
      <span class="grow text-right">1 ETH</span>
    </LayoutCard> -->

    <h2 class="mb-4 font-semibold text-neutral-600" v-if="appMeta.hasCompletedInitialTransfer">Applications</h2>

    <div v-if="appMeta.hasCompletedInitialTransfer">
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
          <div class="flex gap-2" v-if="!isAaveSupplyClicked">
            <TokenEth :height="48"/>
            <div class="grow flex justify-stretch">
              <div class="grow">
                <div>ETH</div>
                <div class="text-sm text-neutral-600">ZKsync</div>
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
              <ZkButton type="secondary" @click="isAaveSupplyClicked = true">Supply</ZkButton>
              <ZkButtonIcon type="secondary" icon="more_horiz"/>
            </div>
          </div>
          <div class="flex flex-col gap-2" v-else>
            <div class="flex items-center gap-2">
              <ZkButtonIcon type="ghost" icon="arrow_back" @click="isAaveSupplyClicked = false"></ZkButtonIcon>
              <span>Supply ETH</span>
              <TokenEth :height="26"/>
            </div>
            <div class="grow flex justify-stretch py-8">
              <span>Stake 0.1 ETH</span>
            </div>
            <div class="flex justify-center">
              <ZkButton type="primary" @click="supplyEthToAaave" class="w-full py-0 text-l">Supply ETH</ZkButton>
            </div>
          </div>
        </template>
        <template #tab2>
          Supplies
        </template>
      </ZkTabs>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { createPublicClient, formatEther, http, parseEther, type Address } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { zksyncInMemoryNode } from 'viem/zksync';
import { createZksyncPasskeyClient } from 'zksync-account/client/passkey';
import OnRampCrypto from '~/components/app/OnRampCrypto.vue';

const { appMeta, userDisplay, userRevTag, contracts, aaveAddress } = useAppMeta();
const { push } = useRouter();
const accountBalance = ref(0n);
const isAaveSupplyClicked = ref(false);

if (!appMeta.value.cryptoAccountAddress) {
  // If there's no crypto address, redirect to landing page
  push("/");
}

const publicClient = createPublicClient({
  chain: zksyncInMemoryNode,
  transport: http(),
});

if (appMeta.value.cryptoAccountAddress) {
  accountBalance.value = await publicClient.getBalance({
    address: appMeta.value.cryptoAccountAddress! as Address,
  });
}

watch(appMeta, async (newValue, oldValue) => {
  if (!newValue.cryptoAccountAddress) { return; }

  console.log("Updating balance...");
  accountBalance.value = await publicClient.getBalance({
    address: newValue.cryptoAccountAddress! as Address,
  });
});

const supplyEthToAaave = async () => {
  // Send 0.1 ETH to the AAVE address
  const passkeyClient = createZksyncPasskeyClient({
    address: appMeta.value.cryptoAccountAddress! as Address,
    credentialPublicKey: new Uint8Array(JSON.parse(appMeta.value.credentialPublicKey!)),
    userDisplayName: userDisplay,
    userName: userRevTag,
    contracts,
    chain: zksyncInMemoryNode,
    transport: http(),
  });
  
  console.log("Sending 0.1 ETH to AAVE Address");
  await passkeyClient.sendTransaction({
    to: aaveAddress as Address,
    value: parseEther("0.1"),
  });
  
  // Update that Aave Staking is completed
  appMeta.value = {
    ...appMeta.value,
    hasCompletedAaveStake: true,
  };
  isAaveSupplyClicked.value = false;
};
</script>
