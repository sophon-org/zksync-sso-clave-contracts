<template>
  <main class="grow p-4 flex flex-col items-center">
    <AppAccountLogo
      class="dark:text-neutral-100 h-16 md:h-20 mb-8"
    />

    <ZkLink
      type="primary"
      class="w-full"
      href="/login"
    >
      Login to your ZK Account
    </ZkLink>
    <ZkLink
      type="secondary"
      class="w-full mt-4"
      href="/register"
    >
      Create a ZK Account
    </ZkLink>
  </main>
</template>

<script setup lang="ts">
import { useColorMode } from "@vueuse/core";

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
