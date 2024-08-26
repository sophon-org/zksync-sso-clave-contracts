<template>
  <div class="app-layout">
    <main class="app-layout-main">
      <NuxtPage />
    </main>
  </div>
</template>

<script lang="ts" setup></script>

<style lang="scss" scoped>
.app-layout {
  @apply flex overflow-clip;
  min-height: 100vh;
  min-height: 100dvh;

  .app-layout-main {
    @apply min-h-full w-full max-w-[1300px] mx-auto;
  }
}
</style>
