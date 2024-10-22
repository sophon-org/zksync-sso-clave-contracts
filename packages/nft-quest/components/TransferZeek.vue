<template>
  <div>
    <ZkButton
      v-if="!showTransfer"
      type="primary"
      class="uppercase w-full"
      @click="sendToFren"
    >
      Send to fren
    </ZkButton>
    <div
      v-else
      class="text-neutral-400 flex flex-col md:flex-row"
    >
      <ZkInput placeholder="The wallet address" />
      <ZkButton
        type="primary"
        class="uppercase mt-4"
      >
        Send meow
      </ZkButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const showTransfer = ref(false);

const sendToFren = () => {
  showTransfer.value = true;
};
</script>
