<template>
  <ViewsConfirmationRequestAccounts v-if="!session" />
  <ViewsConfirmationRequestSession
    v-else
    :session="session"
  />
</template>

<script lang="ts" setup>
import type { SessionPreferences } from "zksync-sso";

const { request } = storeToRefs(useRequestsStore());

// TODO: if user is logged in and has an active session,
// display the request account view
// if user is logged in but does not have an active session,
// display the request session view

const session = computed<SessionPreferences | undefined>(() => {
  if (request.value?.content.action.method !== "eth_requestAccounts") return undefined;
  if ("session" in (request.value.content.action.params!)) {
    return request.value.content.action.params.session;
  }
  return undefined;
});
</script>
