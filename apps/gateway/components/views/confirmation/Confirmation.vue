<template>
  <ViewsConfirmationSend />
</template>

<script lang="ts" setup>
const { request } = storeToRefs(useRequestsStore());

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const method = computed(() => request.value?.request.action.method);
</script>
