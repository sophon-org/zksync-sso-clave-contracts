<template>
  <component
    :is="as"
    class="line-container"
  >
    <slot />
  </component>
</template>

<script lang="ts" setup>
defineProps({
  as: {
    type: [String, Object] as PropType<string | Component>,
    default: "div",
  },
});
</script>

<style lang="scss" scoped>
.line-container {
  @apply w-full rounded-[1.24rem] bg-neutral-900;
}
</style>
