<template>
  <div class="h-full flex flex-col">
    <div class="flex justify-center items-center isolate mt-6">
      <IconsZkSync class="w-full h-auto max-h-10 max-w-full object-contain" />
    </div>
    <h1 class="text-white text-center text-2xl mt-8 font-semibold">
      Login to your account
    </h1>
    {{ error }}
    <div class="mt-auto flex flex-col gap-4">
      <CommonButton
        class="w-full"
        :loading="loginInProgress"
        @click="connectToAccount()"
      >
        Create account
      </CommonButton>
      <CommonButton
        class="w-full"
        variant="neutral"
        :loading="loginInProgress"
        @click="connectToAccount()"
      >
        I already have account
      </CommonButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
const { login } = useAccountStore();

const { inProgress: loginInProgress, execute: connectToAccount, error } = useAsync(async () => {
  await requestPassKey("ZKsync Account", "");
  login({
    privateKey: "0x4ab2ece42121c123ac09b423499c665360fa9c23772d6b72f689b9c31f4f014d",
  });
});
</script>
