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
        required
        placeholder="Username"
        class="w-full"
        :error="hasErrors"
        :messages="[registerError, accountDataFetchError, accountData ? 'Username already taken' : '']"
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
      class="mt-8"
      ui="border-b-0"
      type="ghost"
      href="/login"
    >
      Login to your ZK Account
    </ZkLink>
  </main>
</template>

<script setup lang="ts">
import { zksyncInMemoryNode } from "viem/chains";

definePageMeta({
  middleware: ["redirect-dashboard"],
});

const chainId = zksyncInMemoryNode.id;
const username = ref("");

const { accountDataFetchInProgress, accountDataFetchError, accountData } = await useAccountFetch(
  "register",
  username,
  computed(() => chainId),
);
const { registerInProgress, createAccount, registerError } = await useAccountRegistration(username);

const hasErrors = computed(() => {
  return !loadingInProgress.value && (!!accountData.value || !!registerError.value || !!accountDataFetchError.value);

  // return !loadingInProgress.value && (!!registerError.value || !!accountDataFetchError.value);
});
const loadingInProgress = computed(() => {
  return registerInProgress.value === "pending" || accountDataFetchInProgress.value === "pending";
});

const registerUser = async () => {
  if (!username.value || loadingInProgress.value) {
    return;
  }

  await createAccount().then(() => {
    navigateTo("/dashboard");
  });
};
</script>
