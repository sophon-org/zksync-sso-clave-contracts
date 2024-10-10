<template>
  <main class="grow p-4 flex flex-col items-center">
    <AppAccountLogo
      class="dark:text-neutral-100 h-16 md:h-20 mb-8"
    />
    <p class="dark:text-neutral-300 mb-4">
      Authorize your ZK Account
    </p>
    <ZkLink
      type="primary"
      class="w-full"
      href="/login"
    >
      Login to your ZK Account
    </ZkLink>
    <ZkButton
      type="secondary"
      class="w-full mt-4"
    >
      Create a ZK Account
    </ZkButton>
    <p class="dark:text-neutral-300 py-6">
      or
    </p>
    <ZkButton
      type="secondary"
      class="w-full"
      disabled
      @click="modal.open()"
    >
      Connect your wallet
    </ZkButton>
  </main>
</template>

<script setup lang="ts">
import { useColorMode } from "@vueuse/core";

const modal = useConfig();

const mode = useColorMode({
  modes: {
    light: "light-mode",
    dark: "dark-mode",
  },
});

const isDark = ref(mode.value === "dark");

watchEffect(() => {
  mode.value = isDark.value ? "dark" : "light";
});
</script>
