<template>
  <div class="h-dvh">
    <div class="m-2 text-center flex justify-center">
      <ZkButtonIcon icon="close" class="h-8 w-8 absolute top-0 left-0" @click="cancelTransaction"/>
      <ZkIcon icon="lock" />
      <span class="font-bold">
        Checkout
      </span>
    </div>
    <LayoutCard ui="p-2 bg-neutral-100 text-xs text-neutral-700 border-neutral-100">
      <p>Don't invest unless you're prepared to lose all the money you invest. This is a high-risk investment and you should not expect to be protected if something goes wrong. <a href="#" class="text-primary-500">Take 2 minutes to learn more.</a></p>
    </LayoutCard>

    <h2 class="my-6 font-bold text-lg">Order Summary</h2>

    <div class="rounded-zk p-1 bg-white">
      <div class="rounded-zk bg-primary-100/50 font-bold p-4">Purchasing</div>
      <div class="flex p-4 gap-2">
      <TokenEth :height="48"/>
      <div class="grow flex justify-stretch">
        <div class="grow">
          <div>Ethereum</div>
          <div class="text-sm text-neutral-600">{{transferAmount}} ETH</div>
        </div>
      </div>
      <div class="flex gap-2">
        <p class="text-sm font-medium">£{{(transferAmount * priceOfEth).toLocaleString(undefined, {maximumFractionDigits: 2})}}</p>
      </div>
    </div>
    </div>

    <div class="rounded-zk bg-white px-4 mt-4">
      <div class="flex py-4">
        <div class="grow text-neutral-500">To</div>
        <div class="text-right">
          <div>Wallet</div>
          <div class="text-sm text-neutral-600">
            {{ appMeta.cryptoAccountAddress?.slice(0,5) + '...' + appMeta.cryptoAccountAddress?.slice(-3)  }}
          </div>
        </div>
      </div>
      <div class="flex py-4">
        <div class="grow text-neutral-500">Network</div>
        <div class="text-right">
          <div>ZKsync Era</div>
        </div>
      </div>
      <div class="flex py-4">
        <div class="grow text-neutral-500">Price</div>
        <div class="text-right">
          <div>ETH 1 = £{{priceOfEth.toLocaleString(undefined, {maximumFractionDigits: 2})}}</div>
        </div>
      </div>
    </div>

    <div class="rounded-zk p-4 bg-white mt-4">
      <div class="flex justify-between">
        <div class="text-neutral-500">Total</div>
        <div class="font-bold">£{{(transferAmount * priceOfEth).toLocaleString(undefined, {maximumFractionDigits: 2})}}</div>
      </div>
    </div>

    <p class="mt-4 text-xs text-neutral-600 text-center">
      By continuing, I confirm I accept the <a href="#" class="text-primary-500">Terms & Conditions</a> and have read the <a href="#" class="text-primary-500">Privacy Notice</a>.
    </p>

    <div class="flex justify-center pb-12">
      <ZkButton type="primary" class="mt-4" @click="continueToTransferConfirmation">
        Pay £{{(transferAmount * priceOfEth).toLocaleString(undefined, {maximumFractionDigits: 2})}}
      </ZkButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createPublicClient, createWalletClient, formatEther, http, parseEther, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const history = useHistory();

const transferAmount = ref(1);
const priceOfEth = 1786.79;

const { appMeta, deployerKey } = useAppMeta();
const config = useRuntimeConfig();

const cancelTransaction = () => {
  navigateTo("/crypto-account");
};

const continueToTransferConfirmation = async () => {
  // Send that account 1 ETH from deployer account
  const deployerClient = createWalletClient({
    account: privateKeyToAccount(deployerKey as Address),
    chain: config.public.network,
    transport: http(),
  });

  await deployerClient.sendTransaction({
    to: appMeta.value.cryptoAccountAddress!,
    value: parseEther("1")
  });

  const publicClient = createPublicClient({
    chain: config.public.network,
    transport: http(),
  });

  const balance = await publicClient.getBalance({
    address: appMeta.value.cryptoAccountAddress!
  });

  console.log("balance after transfer of 1 ETH");
  console.log(`${formatEther(balance)} ETH`);


  history.value.mainAccount.unshift({
    description: "www.revolut.com/*London",
    time: "Pending - A few minutes ago",
    amount: "- £1,786.79",
    icon: "currency_bitcoin",
  });

  history.value.cryptoAccount.unshift({
    description: "Received from Main account",
    time: "Pending - A few minutes ago",
    amount: "+ 1.0000 ETH",
    icon: "add",
  });
  // Update UI to show completed transfer of 1 ETH
  appMeta.value = {
    ...appMeta.value,
    hasCompletedInitialTransfer: true,
  };

  navigateTo("/crypto-account");
};
</script>
