<template>
  <zk-tooltip :label="copyLabel">
    <zk-button-icon
      icon="open_in_new"
      @click="copyContent"
      :ui="{ button: { base: 'py-0' } }"
    />
  </zk-tooltip>
</template>

<script setup lang="ts">
const props = defineProps({
  content: {
    type: String,
    required: true,
  },
});

const { copy } = useClipboard({
  source: props.content,
});

const copyLabel = ref("Copy");

function copyContent() {
  copy(props.content);
  copyLabel.value = "Copied!";
  setTimeout(() => {
    copyLabel.value = "Copy";
  }, 2500);
}
</script>
