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
const { isLoggedIn } = storeToRefs(useAccountStore());
const { init } = useCommunicatorStore();

const route = useRoute();
init(route.query.origin! as string);

// If user logs out, redirect them to /confirm
watch(isLoggedIn, async (newValue, oldValue) => {
  if (!newValue && oldValue) {
    await navigateTo("/confirm");
  }
});
</script>
