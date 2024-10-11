<template>
  <main class="p-4 grow flex flex-col items-center">
    <AppAccountLogo
      class="dark:text-neutral-100 h-16 md:h-20 mb-8"
    />
    <p class="dark:text-neutral-300 mb-4">
      Create a new ZK account with a username.
    </p>
    <form
      class="w-full"
      @submit.prevent="registerUser()"
    >
      <ZkInput
        v-model="username"
        placeholder="Username"
        class="w-full"
        :messages="errorMessages"
        :state="errorMessages.length ? 'error' : undefined"
      />
      <ZkButton
        type="primary"
        class="w-full mt-4"
        :loading="loadingInProgress"
        submit
      >
        Create ZK Account
      </ZkButton>
    </form>
    <ZkLink
      class="mt-4 w-full"
      type="secondary"
      href="/login"
    >
      Login to your ZK Account
    </ZkLink>
  </main>
</template>

<script setup lang="ts">
import { parseEther, toHex } from "viem";
import { zksyncInMemoryNode } from "viem/chains";
import { registerNewPasskey } from "zksync-account/client/passkey";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { deployAccount } from "zksync-account/client";

const chainId = zksyncInMemoryNode.id;
const { getRichWalletClient } = useClientStore();
const { login } = useAccountStore();

const username = ref("");
const errorMessages: Ref<string[]> = ref([]);
const loadingInProgress = computed(() => {
  if (accountDataFetchInProgress.value || registerInProgress.value) {
    return true;
  } else {
    return false;
  }
});

const { accountDataFetchInProgress, accountDataFetchError } = useFetchAccountData(
  username,
  computed(() => chainId),
);

watch(accountDataFetchError, () => {
  if (accountDataFetchError.value) {
    errorMessages.value = ["Username is already taken. Please choose another one."];
  } else {
    errorMessages.value = [];
  }
});

const registerUser = () => {
  if (loadingInProgress.value) {
    return;
  }
  if (username.value === "") {
    errorMessages.value = ["Username is required."];
  }

  createAccount();
};

const { inProgress: registerInProgress, execute: createAccount } = useAsync(async () => {
  try {
    const { credentialPublicKey } = await registerNewPasskey({
      userName: username.value,
      userDisplayName: username.value,
    }).catch(() => {
      throw new Error("Failed to register new passkey.");
    });

    /* TODO: implement username check */
    /* await fetchAccountData();
  if (accountData.value) {
    return; // username is taken
  } */
    const deployerClient = getRichWalletClient({ chainId: chainId });
    const sessionKey = generatePrivateKey();
    const sessionPublicKey = privateKeyToAddress(sessionKey);

    // Breaks at this following step

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { address } = await deployAccount(deployerClient as any, {
      credentialPublicKey,
      uniqueAccountId: username.value,
      /* TODO: Remove spend limit, right now deployment fails without initial data */
      initialSessions: [
        {
          sessionPublicKey,
          expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
          spendLimit: {
            "0x111C3E89Ce80e62EE88318C2804920D4c96f92bb": "10000",
          },
        },
      ],
      contracts: contractsByChain[chainId],
    }).catch(() => {
      throw new Error("Failed to deploy account.");
    });

    await deployerClient.sendTransaction({
      to: address,
      value: parseEther("1"),
    }).catch(() => {
      throw new Error("Failed to send transaction.");
    });

    console.log("ACCOUNT ==========");
    console.log(username.value, address, toHex(credentialPublicKey), sessionKey);
    login({
      username: username.value,
      address: address,
      passkey: toHex(credentialPublicKey),
      sessionKey,
    });
    await navigateTo({ path: "/dashboard" });
  } catch (error) {
    errorMessages.value = [(error as Error).message];
    return;
  }
});
</script>
