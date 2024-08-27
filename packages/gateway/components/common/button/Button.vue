<template>
  <component
    :is="as"
    :disabled="disabled || loading ? true : undefined"
    type="button"
    class="default-button"
    :class="[`size-${size}`, `variant-${variant}`]"
  >
    <span
      class="icon-container"
      :class="{ 'icon-visible': $slots.icon || loading }"
    >
      <transition
        v-bind="TransitionOpacity"
        mode="out-in"
      >
        <CommonSpinner v-if="loading" />
        <slot
          v-else
          name="icon"
        />
      </transition>
    </span>
    <slot />
  </component>
</template>

<script lang="ts" setup>
export type ButtonVariant = "primary" | "neutral";

defineProps({
  as: {
    type: [String, Object] as PropType<string | Component>,
    default: "button",
  },
  variant: {
    type: String as PropType<ButtonVariant>,
    default: "primary",
  },
  size: {
    type: String as PropType<"xs" | "sm" | "md" | "lg">,
    default: "md",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});
</script>

<style lang="scss">
.default-button {
  @apply flex items-center justify-center text-center backdrop-blur-sm transition-all;
  &:is(label) {
    @apply cursor-pointer;
  }
  &.size- {
    &xs {
      @apply rounded-2xl px-3 text-sm py-2;
    }
    &sm {
      @apply rounded-[20px] p-3;
    }
    &md {
      @apply rounded-[32px] p-4;
    }
    &lg {
      @apply rounded-3xl py-6 px-12;
    }
  }
  &.variant- {
    &neutral {
      @apply bg-neutral-900;
      &:enabled,
      &:is(a, label) {
        &:not([aria-disabled="true"]) {
          @apply hover:bg-neutral-800;
        }
      }
    }
    &primary {
      @apply bg-primary-400 px-6 text-white;
      &:enabled,
      &:is(a, label) {
        &:not([aria-disabled="true"]) {
          @apply hover:bg-primary-300;
        }
      }
      &:disabled,
      &[aria-disabled="true"] {
        @apply bg-opacity-50;
      }

      .icon-container.icon-visible {
        @apply w-6 -translate-x-2 transform;
      }
    }
  }
  .icon-container {
    @apply flex-shrink-0 inline-flex w-0 items-center overflow-hidden transition-all will-change-[width,transform];

    svg {
      @apply block h-6 w-6;
    }
  }
}
</style>
