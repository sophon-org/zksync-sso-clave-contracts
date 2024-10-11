<template>
  <main>Hello World</main>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});
</script>
