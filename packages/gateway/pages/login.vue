<template>
  <main class="p-4 grow flex flex-col items-center">
    <AppAccountLogo
      class="dark:text-neutral-100 h-16 md:h-20 mb-8"
    />
    <p class="dark:text-neutral-300 mb-4">
      Login with your ZK account username.
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
      Login
    </ZkButton>
  </main>
</template>

<script setup lang="ts">
const username = ref("");

const loginUser = () => {
  console.log(username.value);
};
</script>
