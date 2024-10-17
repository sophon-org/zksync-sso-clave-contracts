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
definePageMeta({
  middleware: ["redirect-dashboard"],
});
const username = ref("");
const errorMessages: Ref<string[]> = ref([]);
const loadingInProgress = computed(() => {
  if (loginInProgress.value) {
    return true;
  } else {
    return false;
  }
});

const loginUser = () => {
  if (!username.value || loginInProgress.value) {
    return;
  }

  connectToAccount().catch((error) => {
    console.error(error);
    errorMessages.value = [(error as Error).message];
  });
};

const { inProgress: loginInProgress, execute: connectToAccount } = useAsync(async () => {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(32),
      userVerification: "discouraged",
    },
  }).catch(() => {
    throw new Error("Passkey verification was interrupted. Please try again.");
  });
  if (!credential) throw new Error("There are no registered passkeys for this user.");

  console.log({ credential });
  console.log("Login not implemented yet");
  console.log("CREDENTIALS", credential);
  /* TODO: find account by credential.id */
});
</script>
