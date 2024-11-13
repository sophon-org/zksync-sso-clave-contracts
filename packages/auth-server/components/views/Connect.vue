<template>
  <ViewsConfirmationRequestAccounts v-if="!sessionPreferences" />
  <ViewsConfirmationRequestSession
    v-else
    :session-preferences="sessionPreferences"
  />
</template>

<script lang="ts" setup>
import type { SessionPreferences } from "zksync-sso";

const { request } = storeToRefs(useRequestsStore());

const sessionPreferences = computed<SessionPreferences | undefined>(() => {
  if (request.value?.content.action.method !== "eth_requestAccounts") return undefined;
  if ("sessionPreferences" in (request.value.content.action.params!)) {
    return request.value.content.action.params.sessionPreferences;
  }
  return undefined;
});
</script>
