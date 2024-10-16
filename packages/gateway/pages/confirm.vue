<template>
  <TransitionGroup
    v-bind="TransitionOpacity"
    tag="div"
    mode="out-in"
    class="h-dvh"
  >
    <ViewsLogin
      v-if="!isLoggedIn"
      key="login"
    />
    <ViewsLoading
      v-else-if="!appMeta || !hasRequests"
      key="loading"
    />
    <ViewsConnect
      v-else-if="requestMethod === 'eth_requestAccounts'"
      key="connect"
    />
    <ViewsConfirmation
      v-else
      key="confirmation"
    />
  </TransitionGroup>
</template>

<script lang="ts" setup>
const { appMeta } = useAppMeta();
const { isLoggedIn } = storeToRefs(useAccountStore());
const { hasRequests, requestMethod } = storeToRefs(useRequestsStore());

definePageMeta({
  layout: "popup",
});

communicator.init();
</script>
