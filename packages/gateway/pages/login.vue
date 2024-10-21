<template>
  <main class="p-4 grow flex flex-col items-center">
    <AppAccountLogo
      class="dark:text-neutral-100 h-16 md:h-20 mb-8"
    />
    <p class="dark:text-neutral-300 mb-4">
      Login with your ZK account username.
    </p>
    <form
      class="w-full"
      @submit.prevent="loginUser"
    >
      <ZkInput
        v-model="username"
        placeholder="Username"
        class="w-full"
        :error="hasErrors"
        required
        :messages="[loginError, accountDataFetchError]"
      />
      <ZkButton
        type="primary"
        class="w-full mt-4"
        :loading="loadingInProgress"
        submit
      >
        Login
      </ZkButton>
    </form>
    <ZkLink
      class="mt-8"
      ui="border-b-0"
      type="ghost"
      href="/register"
    >
      Create a new ZK Account
    </ZkLink>
  </main>
</template>

<script setup lang="ts">
import { zksyncInMemoryNode } from "viem/chains";

definePageMeta({
  middleware: ["logged-in"],
});

const chainId = zksyncInMemoryNode.id;
const username = ref("");

const { loginInProgress, loginAccount, loginError } = await useAccountLogin();
const { accountDataFetchInProgress, accountDataFetchError } = await useAccountFetch(
  "login",
  username,
  computed(() => chainId),
);

const loadingInProgress = computed(() => {
  return loginInProgress.value === "pending" || accountDataFetchInProgress.value === "pending";
});

const hasErrors = computed(() => {
  return !loadingInProgress.value && (!!loginError.value || !!accountDataFetchError.value);
});

const loginUser = () => {
  if (!username.value || loadingInProgress) {
    return;
  }

  loginAccount();
};
</script>
