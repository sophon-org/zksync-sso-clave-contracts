<template>
  <ViewsConfirmationRequestAccounts v-if="!session" />
  <ViewsConfirmationRequestSession
    v-else
    :session="session"
  />
</template>

<script lang="ts" setup>
import type { Session } from "@matterlabs/smart-account-sdk";

const { request } = storeToRefs(useRequestsStore());

const session = computed<Session | undefined>(
  () => request.value?.request.action.params.session
);
</script>
