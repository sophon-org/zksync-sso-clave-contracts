<template>
  <div class="h-full flex items-center flex-col justify-center relative">
    <div class="p-4 grow h-full justify-center flex flex-col">
      <BlurFade
        in-view
        :delay="0"
        class="inline"
      >
        <span class="text-[45px] font-bold tracking-tighter dark:text-white leading-1">
          You've got Zeek.
        </span>
      </BlurFade>
      <GradualSpacing
        v-if="showBanner"
        class="text-[45px] font-bold tracking-tighter leading-1 text-blue-400"
        text="SSO Simple."
        :delay-multiple="25"
      />
      <div
        v-else
        class="text-[45px] font-bold tracking-tighter leading-1 text-neutral-950"
      >
        <!-- To prevent the weird bump in spacing when the gradualSpacing runs. -->
        &nbsp;
      </div>
      <BlurFade
        in-view
        :delay="650"
        class="inline"
      >
        <div class="h-full">
          <p class=" mt-8 text-neutral-400">
            You can now find your NFT in your account on testnet.
            Wasn't that easy? Even I can do it. And I'm a cat. Now share the Zeek.
          </p>
          <ZkLink
            to="https://google.com"
            target="_blank"
            type="secondary"
            class="mt-8"
          >
            Transaction details
            <ZkIcon
              icon="open_in_new"
              class="ml-2"
            />
          </ZkLink>
        </div>
      </BlurFade>
    </div>

    <div class="border-t border-t-neutral-900 w-full p-2">
      <TransferZeek />
    </div>
  </div>
</template>

<script setup lang="ts">
const showBanner = ref(false);

setTimeout(() => {
  showBanner.value = true;
}, 750);
</script>
