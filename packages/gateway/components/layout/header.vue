<template>
  <div class="flex items-center py-8 pt-12 dark:text-neutral-100">
    <div class="text-[40px] flex-auto">
      <slot />
    </div>
    <div class="text-base">
      <slot name="aside" />
    </div>
  </div>
</template>

<script setup lang="ts"></script>
