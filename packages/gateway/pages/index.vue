<template>
  <div class="flex min-h-dvh justify-center pt-24 md:pt-32">
    <main class="flex flex-col items-center">
      <AppAccountLogo
        class="dark:text-neutral-100 h-16 md:h-20 mb-8"
      />
      <p class="dark:text-neutral-300 mb-4">
        Authorize your ZK Account
      </p>
      <ZkButton
        type="primary"
        class="w-full"
        @click="modal.open()"
      >
        Login to your ZK Account
      </ZkButton>
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
      >
        Connect your wallet
      </ZkButton>
    </main>
  </div>
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
