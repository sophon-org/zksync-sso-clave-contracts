<template>
  <div class="h-full flex flex-col justify-center px-4">
    <div class="h-[40%] justify-center items-center flex flex-col">
      <div class="mx-auto mt-6 w-20 h-20 bg-neutral-800 rounded-md">
        <img
          v-if="appMeta && appMeta.icon"
          :src="appMeta.icon"
          :alt="appMeta.name"
          class="h-full w-full object-cover rounded-md"
        >
      </div>
      <h1 class="text-white text-center text-2xl mt-4 font-semibold">
        Connect to {{ appMeta?.name }}
      </h1>
    </div>

    <div class="flex flex-col gap-5 mt-8 py-8">
      <ZkHighlightWrapper>
        <ZkButton
          class="w-full"
          :loading="registerInProgress"
          @click="createAccount"
        >
          Sign Up
        </ZkButton>
      </ZkHighlightWrapper>

      <ZkButton
        type="secondary"
        class="!text-slate-400"
        :loading="loginInProgress"
        @click="loginToAccount"
      >
        Sign In
      </ZkButton>
    </div>

    <CommonHeightTransition :opened="!!accountLoginError">
      <p class="pt-3 text-sm text-error-300 text-center">
        <span>
          Account not found.
          <button
            type="button"
            class="underline underline-offset-4"
            @click="createAccount"
          >
            Sign up?
          </button>
        </span>
      </p>
    </CommonHeightTransition>
  </div>
</template>

<script lang="ts" setup>
const { appMeta } = useAppMeta();
const { requestChain } = storeToRefs(useRequestsStore());

const { registerInProgress, createAccount } = useAccountCreate(computed(() => requestChain.value!.id));
const { loginInProgress, accountLoginError, loginToAccount } = useAccountLogin(computed(() => requestChain.value!.id));
</script>
