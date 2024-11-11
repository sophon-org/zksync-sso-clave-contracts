<template>
  <div>
    <layout-header>
      <span class="font-thin">Welcome in,</span>
      <span class="font-thin block leading-8">{{ username }}<span class="text-neutral-500">@zksync.eth</span></span>
      <template #aside>
        <zk-button-icon
          type="secondary"
          icon="dashboard_customize"
        />
      </template>
    </layout-header>
  </div>
</template>

<script setup lang="ts">
const { username } = useAccountStore();
</script>
