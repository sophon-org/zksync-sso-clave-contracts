<template>
  <ViewsConfirmationSend />
</template>

<script lang="ts" setup>
const { request } = storeToRefs(useRequestsStore());

const method = computed(() => request.value?.request.action.method);
</script>
