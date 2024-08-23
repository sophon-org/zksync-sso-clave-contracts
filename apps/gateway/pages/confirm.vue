<template>
  <div class="flex items-center justify-center h-full">
    <TransitionGroup
      v-bind="TransitionOpacity"
      tag="div"
      mode="out-in"
      class="w-full h-full xs:max-w-[450px] xs:h-max bg-neutral-950 xs:rounded-[32px] p-4"
    >
      <ViewsLogin
        v-if="!isLoggedIn"
        key="login"
      />
      <ViewsLoading
        v-else-if="!appMeta || !request"
        key="loading"
      />
      <ViewsConnect
        v-else-if="requestType === 'handshake'"
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
const { request, requestType } = storeToRefs(useRequestsStore());

communicator.init();
</script>
