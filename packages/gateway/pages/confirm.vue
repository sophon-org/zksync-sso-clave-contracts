<template>
  <div class="flex items-center justify-center h-full">
    <TransitionGroup
      v-bind="TransitionOpacity"
      tag="div"
      mode="out-in"
      class="h-full w-panel xs:h-max bg-neutral-950 xs:rounded-[32px] p-4"
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
  </div>
</template>

<script lang="ts" setup>
const { appMeta } = useAppMeta();
const { isLoggedIn } = storeToRefs(useAccountStore());
const communicator = useCommunicator();

communicator.setOrigin(window.location.search);

const { hasRequests, requestMethod } = storeToRefs(useRequestsStore());
</script>
