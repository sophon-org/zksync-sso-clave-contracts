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
      Send 0.5 ETH
    </button>
  </div>
</template>

<script setup>
import { disconnect, getBalance, watchAccount } from "@wagmi/core";
// import { useSendTransaction } from "@wagmi/vue";
import { createWeb3Modal, defaultWagmiConfig } from "@web3modal/wagmi/vue";
// import { parseEther } from "viem";
import { zksyncInMemoryNode } from "viem/chains";
import { zksyncAccountConnector } from "zksync-account/connector";

const address = ref(null);
const balance = ref(null);
const projectId = "dde7b251fcfd7e11d5270497a053816e"; // TODO: Move to env

// Define the chains you want to support
const chains = [zksyncInMemoryNode];

// Create wagmi config
const config = defaultWagmiConfig({
  chains,
  projectId,
  appName: "ZKsync SSO Demo",
  connectors: [
    zksyncAccountConnector({
      metadata: {
        name: "ZKsync SSO Demo",
        icon: "https://zksync.io/favicon.ico",
      },
      gatewayUrl: "http://localhost:3002/confirm",
      session: {
        expiresAt: Date.now() + 1000 * 60 * 60 * 24, // Expires in 24 hours (1 day) from now
        spendLimit: {
          ["0x000000000000000000000000000000000000800A"]: 1000000000000000000,
        },
      },
    }),
  ],
});

const web3modal = createWeb3Modal({ wagmiConfig: config, projectId, chains });

// Check for updates to the current account
watchAccount(config, {
  async onChange(data) {
    address.value = data.address;
    const currentBalance = await getBalance(config, {
      address: data.address,
    });
    balance.value = `${currentBalance.formatted} ${currentBalance.symbol}`;
  },
});

const connectWallet = async () => {
  if (address.value) {
    await disconnect(config);
    return;
  }

  try {
    await web3modal.open();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Connection failed:", error);
  }
};

// const { sendTransaction } = useSendTransaction({ config });

const sendTokens = async () => {
  console.log("send tokens");
  // sendTransaction(config, {
  //   from: address.value,
  //   to: "0x55bE1B079b53962746B2e86d12f158a41DF294A6", // Rich Account 1
  //   value: parseEther("0.1"),
  // });
};
</script>
