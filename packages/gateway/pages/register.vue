<template>
  <main class="p-4 grow flex flex-col items-center">
    <AppAccountLogo
      class="dark:text-neutral-100 h-16 md:h-20 mb-8"
    />
    <p class="dark:text-neutral-300 mb-4">
      Create a new ZK account with a username.
    </p>
    <ZkInput
      v-model="username"
      placeholder="Username"
      class="w-full"
    />
    <ZkButton
      type="primary"
      class="w-full mt-4"
      @click="loginUser"
    >
      Create ZK Account
    </ZkButton>
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
const username = ref("");

const communicator = useCommunicator();
// const { requestChain } = storeToRefs(useRequestsStore());

communicator.setOrigin(window.location.host, true);

// const { accountData, accountDataFetchInProgress, accountDataFetchError/* , fetchAccountData */ } = useFetchAccountData(
//   username,
//   computed(() => requestChain.value!.id),
// );

const loginUser = () => {
  console.log(username.value);
};
</script>
