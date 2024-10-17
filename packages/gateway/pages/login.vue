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
        :messages="errorMessages"
        :state="errorMessages.length ? 'error' : undefined"
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
// import { zksyncInMemoryNode } from "viem/chains";

definePageMeta({
  middleware: ["redirect-dashboard"],
});

// const chainId = zksyncInMemoryNode.id;

const username = ref("");
const errorMessages: Ref<string[]> = ref([]);
const loadingInProgress = computed(() => {
  if (loginInProgress.value === "pending") {
    return true;
  } else {
    return false;
  }
});

const { status: loginInProgress, execute: connectToAccount } = await useAccountLogin();

// const { accountData, accountDataFetchInProgress, accountDataFetchError/* , fetchAccountData */ } = useFetchAccountData(
//   username,
//   computed(() => chainId),
// );

const loginUser = () => {
  if (!username.value || loginInProgress.value === "pending") {
    return;
  }

  connectToAccount().catch((error) => {
    errorMessages.value = [(error as Error).message];
  });
};
</script>
