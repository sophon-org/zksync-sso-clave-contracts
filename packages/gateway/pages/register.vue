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
const errorMessages: Ref<string[]> = ref([]);

const { status: registerInProgress, execute: createAccount, error: registerError } = await useAccountRegistration(username);

const loadingInProgress = computed(() => {
  if (accountDataFetchInProgress.value || registerInProgress.value === "pending") {
    return true;
  } else {
    return false;
  }
});

watch(registerInProgress, () => {
  switch (registerInProgress.value) {
    case "pending":
      errorMessages.value = [];
      break;
    case "success":
      errorMessages.value = [];
      navigateTo({ path: "/dashboard" });
      break;
    case "error":
      errorMessages.value = [(registerError.value as Error).message];
      break;
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
</script>
