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

    <div v-if="!appMeta.hasCompletedInitialTransfer" class="flex flex-col justify-center items-center mb-6">
      <div class="bg-green-500 text-neutral-700 dark:text-neutral-300 dark:bg-neutral-800 w-[44px] h-[44px] p-2 rounded-full text-center">
        <ZkIcon icon="check" :ui="'text-white'"/>
      </div>
      <p class="text-lg text-neutral-700">Crypto account created.</p>
    </div>

    <LayoutCard class="flex gap-8 items-center justify-between mb-8 !py-2 !px-4" >
        <span class="text-l font-bold">Crypto Account Address</span>
        <div>
          <span>{{ appMeta.cryptoAccountAddress?.slice(0,5) + '...' + appMeta.cryptoAccountAddress?.slice(-3)  }}</span>
          <ZkCopy :content="appMeta.cryptoAccountAddress! as string" />
        </div>
    </LayoutCard>

    <OnRampCrypto v-if="!appMeta.hasCompletedInitialTransfer"/>

    <LayoutCard v-else class="mb-8">
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
      <div v-for="(item, index) in history.cryptoAccount" :key="index" class="flex gap-2 mt-4">
        <ZkIconThumbnail :icon="item.icon" />
        <div class="grow">
          <p>{{ item.description }}</p>
          <p class="text-sm text-neutral-600">{{ item.time }}</p>
        </div>
        <div class="text-2xl font-light">
          {{ item.amount }}
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

    <h2 v-if="appMeta.hasCompletedInitialTransfer" class="mb-4 font-semibold text-neutral-600">Applications</h2>

    <div v-if="appMeta.hasCompletedInitialTransfer">
      <div class="bg-primary-200 rounded-t-zk flex items-center justify-center gap-2 py-4">
        <img src="/aave-logo.png" class="rounded-lg h-[32px]"  >
        <span class="text-white">AAVE</span>
      </div>
      <div class="bg-white rounded-b-zk pt-4 px-8 pb-8">
        <ZkTabs
          v-model="tabSlot"
          :tabs="[
            { slot: 'tab1', label: 'Assets to supply' },
            { slot: 'tab2', label: 'Your supplies' },
          ]"
        >
        <template #tab1>
          <div v-if="!isAaveSupplyClicked" class="flex gap-2">
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
          <div v-else class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <ZkButtonIcon type="ghost" icon="arrow_back" @click="isAaveSupplyClicked = false"/>
              <span>Supply ETH</span>
              <TokenEth :height="26"/>
            </div>
            <div class="flex flex-col justify-stretch py-8 pb-2">
              <div class="flex grow">
                <div class="grow text-neutral-700 text-sm font-bold">Amount</div>
                <div>Balance: {{ (+formatEther(accountBalance)).toFixed(6) }}</div>
              </div>
              <div class="relative">
                <input v-model="stakeAmount" class="w-full text-neutral-800 rounded-zk p-4 pb-8 mt-2 border border-neutral-800" type="text" placeholder="0.1">
                <div class="absolute bottom-1 left-4 text-neutral-600">£{{(stakeAmount * cart.priceOfEth).toFixed(2)}}</div>
              </div>
            </div>
            <p class="text-sm font-bold text-neutral-700">Transaction overview</p>
            <div class="rounded-zk bg-neutral-100 p-4 text-neutral-700">
              <div class="flex">
                <span class="grow">Supply APY</span>
                <span class="text-right">0.47%</span>
              </div>
              <div class="flex pt-2">
                <span class="grow">Collateralization</span>
                <span class="text-right">Enabled</span>
              </div>
            </div>
            <div class="flex items-center py-1">
              <ZkIcon icon="local_gas_station"/> $0.03
            </div>
            <div class="flex justify-center">
              <ZkButton type="primary" class="w-full py-0 text-l" @click="supplyEthToAave">Supply ETH</ZkButton>
            </div>
          </div>
        </template>
        <template #tab2>
          <div v-if="appMeta.hasCompletedAaveStake">
            <div class="flex gap-4 mb-2">
            <div class="flex grow gap-4">
              <div class="bg-green-500 text-neutral-700 dark:text-neutral-300 dark:bg-neutral-800 w-[44px] h-[44px] p-2 rounded-full text-center">
              <ZkIcon icon="check" :ui="'text-white'"/>
            </div>
            <h3 class="text-3xl font-bold">All done!</h3>
            </div>
            <div class="text-center">
              <p class="text-lg text-neutral-700">You supplied 0.1 ETH</p>
              <a href="#" class="text-neutral-700 underline">Review tx details</a>
            </div>
          </div>
          <div class="rounded-zk bg-neutral-100 p-4">
            <span class="text-neutral-600 mr-2">Balance</span>
            <span class="mr-6">0.47 %</span>
            <span class="mr-2 text-neutral-600">APY</span>
            <span class="mr-6">0.47 %</span>
            <span class="mr-2 text-neutral-600">Collateral</span>
            <span>£{{(stakeAmount * cart.priceOfEth).toFixed(2)}}</span>
          </div>
          <div class="rounded-zk bg-neutral-100 p-4 mt-4">
            <div class="mb-2 flex items-center">
              <div class="grow flex items-center">
                <TokenEth :height="48"/>
                <div class="ml-2">
                  <div>ETH</div>
                  <div class="text-xs text-neutral-600">Asset</div>
                </div>
              </div>
              <ZkButton type="secondary" class="h-8 mr-2">Supply</ZkButton>
              <ZkButton type="secondary" class="h-8">Withdraw</ZkButton>
            </div>
            <hr class="border-neutral-200">
            <div class="flex mt-2 gap-4">
              <div>
                <span>0.1</span> <span class="text-xs text-neutral-600">£{{(stakeAmount * cart.priceOfEth).toFixed(2)}}</span>
                <div class="text-sm text-neutral-600">Balance</div>
              </div>
              <div>
                <span>0.47%</span>
                <div class="text-sm text-neutral-600">APY</div>
              </div>
              <div>
                <span>Yes</span>
                <div class="text-sm text-neutral-600">Collateral</div>
              </div>
            </div>
          </div>
          </div>
          <div v-else>No assets supplied.</div>
        </template>
      </ZkTabs>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { createPublicClient, formatEther, http, parseEther, type Address, type Chain } from "viem";
import { createZksyncPasskeyClient } from "zksync-account/client/passkey";
import OnRampCrypto from "~/components/app/OnRampCrypto.vue";
import { useTimeoutPoll } from "@vueuse/core";

const { appMeta, userDisplay, userRevTag, contracts, aaveAddress } = useAppMeta();
const history = useHistory();
const accountBalance = ref(0n);
const isAaveSupplyClicked = ref(false);
const cart = useCart();
const stakeAmount = ref(0.1);
const tabSlot = ref<string | number>("tab1");

const config = useRuntimeConfig();

onMounted(() => {
  const getBalance = async () => {
    accountBalance.value = await publicClient.getBalance({
      address: appMeta.value.cryptoAccountAddress! as Address,
    });
  };
  const { resume } = useTimeoutPoll(getBalance, 1000);

  resume();
});

const publicClient = createPublicClient({
  chain: config.public.network as Chain,
  transport: http(),
});

if (appMeta.value.cryptoAccountAddress) {
  accountBalance.value = await publicClient.getBalance({
    address: appMeta.value.cryptoAccountAddress! as Address,
  });
}

watch(appMeta, async (newValue) => {
  if (!newValue.cryptoAccountAddress) { return; }

  console.log("Updating balance...");
  accountBalance.value = await publicClient.getBalance({
    address: newValue.cryptoAccountAddress! as Address,
  });
});

const supplyEthToAave = async () => {
  // Send 0.1 ETH to the AAVE address
  const passkeyClient = createZksyncPasskeyClient({
    address: appMeta.value.cryptoAccountAddress! as Address,
    credentialPublicKey: new Uint8Array(JSON.parse(appMeta.value.credentialPublicKey!)),
    userDisplayName: userDisplay,
    userName: userRevTag,
    contracts,
    chain: config.public.network as Chain,
    transport: http(),
  });

  console.log("contracts", contracts);
  console.log("Sending 0.1 ETH to AAVE Address", aaveAddress);
  await passkeyClient.sendTransaction({
    to: aaveAddress as Address,
    value: parseEther("0.1"),
  });


  // Update that Aave Staking is completed
  history.value.cryptoAccount.unshift({
    description: "Staked on AAVE",
    time: "Just now",
    icon: "savings",
    amount: "- 0.1000 ETH"
  });
  appMeta.value = {
    ...appMeta.value,
    hasCompletedAaveStake: true,
  };
  isAaveSupplyClicked.value = false;
  tabSlot.value = "tab2";
};
</script>
