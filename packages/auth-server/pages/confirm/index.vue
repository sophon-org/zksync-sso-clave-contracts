<template>
  <TransitionGroup
    v-bind="TransitionOpacity"
    tag="div"
    mode="out-in"
    class="h-dvh"
  >
    <ViewsAuth
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
const { init } = useCommunicatorStore();
const { hasRequests, requestMethod } = storeToRefs(useRequestsStore());

const route = useRoute();
init(route.query.origin! as string);

watch(hasRequests, () => {
  if (isLoggedIn.value && requestMethod.value === "eth_requestAccounts") {
    navigateTo("/confirm/connect");
  }
});
</script>
