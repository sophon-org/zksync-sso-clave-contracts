<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-4">
      ZKsync SSO Demo
    </h1>
    <button
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      @click="connectWallet"
    >
      {{ address ? "Disconnect" : "Connect" }}
    </button>
    <div
      v-if="address"
      class="mt-4"
    >
      <p>Connected Address: {{ address }}</p>
    </div>
    <div
      v-if="address && balance"
      class="mt-4"
    >
      <p>Balance: {{ balance }}</p>
    </div>
    <button
      v-if="address"
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      @click="sendTokens()"
    >
      Send 0.1 ETH
    </button>

    <div
      v-if="errorMessage"
      class="p-4 mt-4 mb-4 max-w-96 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400"
    >
      <span class="font-medium">{{ errorMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { disconnect, getBalance, watchAccount, sendTransaction } from "@wagmi/core";
import { createWeb3Modal, defaultWagmiConfig } from "@web3modal/wagmi/vue";
import { parseEther } from "viem";
import { zksyncInMemoryNode } from "viem/chains";
import { zksyncAccountConnector } from "zksync-account/connector";
import { getSession } from "zksync-account/utils";

const address = ref(null);
const balance = ref(null);
const errorMessage = ref(null);
const projectId = "dde7b251fcfd7e11d5270497a053816e"; // TODO: Move to env

const config = defaultWagmiConfig({
  chains: [zksyncInMemoryNode],
  projectId,
  appName: "ZKsync SSO Demo",
  connectors: [
    zksyncAccountConnector({
      metadata: {
        name: "ZKsync SSO Demo",
        icon: "http://localhost:3004/favicon.ico",
      },
      gatewayUrl: "http://localhost:3002/confirm",
      session: getSession({
        feeLimit: { limit: parseEther("0.01") },
        transferPolicies: [{
          target: sessionTarget,
          maxValuePerUse: parseEther("0.1"),
        }],
      }),
    }),
  ],
});

const web3modal = createWeb3Modal({ wagmiConfig: config, projectId });
const sessionTarget = "0x55bE1B079b53962746B2e86d12f158a41DF294A6"; // Rich Account 1

// Check for updates to the current account
watchAccount(config, {
  async onChange(data) {
    address.value = data.address;

    if (!address.value) {
      return;
    }

    const currentBalance = await getBalance(config, {
      address: data.address,
    });
    balance.value = `${currentBalance.formatted} ${currentBalance.symbol}`;
  },
});

const connectWallet = async () => {
  errorMessage.value = "";

  try {
    if (address.value) {
      await disconnect(config);
      return;
    }

    await web3modal.open();
  } catch (error) {
    errorMessage.value = "Connect/Disconnect failed, see console for more info.";
    // eslint-disable-next-line no-console
    console.error("Connection failed:", error);
  }
};

const sendTokens = async () => {
  if (!address.value) {
    return;
  }

  errorMessage.value = "";

  try {
    await sendTransaction(config, {
      to: sessionTarget,
      value: parseEther("0.1"),
      gas: 100_000_000n,
    });

    const currentBalance = await getBalance(config, {
      address: address.value,
    });
    balance.value = `${currentBalance.formatted} ${currentBalance.symbol}`;
  } catch (error) {
    let transactionFailureDetails = error.cause?.cause?.cause?.data?.originalError?.cause?.details;
    if (!transactionFailureDetails) {
      transactionFailureDetails = error.cause?.cause?.data?.originalError?.cause?.details;
    }

    if (transactionFailureDetails) {
      errorMessage.value = transactionFailureDetails;
    } else {
      errorMessage.value = "Transaction failed, see console for more info.";
      // eslint-disable-next-line no-console
      console.error("Transaction failed:", error);
    }
  }
};
</script>
