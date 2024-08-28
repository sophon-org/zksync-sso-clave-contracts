<template>
  <ViewsConfirmationRequestAccounts v-if="!session" />
  <ViewsConfirmationRequestSession
    v-else
    :session="session"
  />
</template>

<script lang="ts" setup>
import type { SessionPreferences } from "@matterlabs/zksync-account";

const { request } = storeToRefs(useRequestsStore());

const session = computed<SessionPreferences | undefined>(
  () => request.value?.request.action.params.session,
);
</script>
