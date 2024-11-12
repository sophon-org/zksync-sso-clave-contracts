<template>
  <TransitionGroup
    v-bind="TransitionOpacity"
    tag="div"
    mode="out-in"
    class="h-dvh"
  >
    <ViewsLoading
      v-if="!appMeta || !hasRequests"
      key="loading"
    />
    <ViewsConnect
      v-else-if="requestMethod === 'eth_requestAccounts'"
      key="connect"
    />
  </TransitionGroup>
</template>

<script lang="ts" setup>
const { appMeta } = useAppMeta();
const { hasRequests, requestMethod } = storeToRefs(useRequestsStore());
</script>
