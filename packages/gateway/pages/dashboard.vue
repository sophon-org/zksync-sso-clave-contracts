<template>
  <div>
    <header class="mb-8">
      <AppNav />
    </header>
    <main class="max-w-dashboard m-auto">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  // middleware: ["auth"],
  layout: "dashboard",
});
</script>
