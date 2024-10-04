<template>
  <div
    class="border border-neutral-200 rounded-zk flex justify-between dark:border-neutral-700 dark:bg-neutral-900"
  >
    <div class="flex items-center pl-3">
      <zk-account-logo :height="24" class="dark:text-neutral-100" />
    </div>
    <div class="flex-auto flex justify-center" ref="menu-wrapper">
      <div class="flex" ref="menu" v-show="!showMobileMenu">
        <a
          href="#"
          class="active w-fit border-y-2 border-transparent border-b-neutral-700 px-5 py-3 text-neutral-900 hover:text-neutral-800 flex items-center dark:text-neutral-100 dark:border-b-neutral-200 dark:hover:text-neutral-100"
        >
          <zk-icon icon="dashboard" class="mr-2" />
          Dashboard
        </a>
        <a
          href="#"
          class="w-fit border-y-2 border-transparent hover:border-b-neutral-500 px-5 py-3 text-neutral-600 hover:text-neutral-800 flex items-center dark:text-neutral-400 dark:hover:text-neutral-300"
        >
          <zk-icon icon="settings" class="mr-2" />
          Settings
        </a>
        <a
          href="#"
          class="w-fit border-y-2 border-transparent hover:border-b-neutral-500 px-5 py-3 text-neutral-600 hover:text-neutral-800 flex items-center dark:text-neutral-400 dark:hover:text-neutral-300"
        >
          <zk-icon icon="description" class="mr-2" />
          History
        </a>
        <a
          href="#"
          class="w-fit border-y-2 border-transparent hover:border-b-neutral-500 px-5 py-3 text-neutral-600 hover:text-neutral-800 flex items-center dark:text-neutral-400 dark:hover:text-neutral-300"
        >
          <zk-icon icon="grid_view" class="mr-2" />
          Marketplace
        </a>
        <a
          href="#"
          class="w-fit border-y-2 border-transparent hover:border-b-neutral-500 px-5 py-3 text-neutral-600 hover:text-neutral-800 flex items-center dark:text-neutral-400 dark:hover:text-neutral-300"
        >
          <zk-icon icon="link" class="mr-2" />
          Connections (4)
        </a>
      </div>
    </div>
    <div class="flex items-center pr-2" v-show="!showMobileMenu">
      <app-color-mode />
    </div>
    <div class="flex items-center pr-2 min-h-[52px]" v-show="showMobileMenu">
      <app-nav-mobile-menu />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from "vue";
import { useWindowSize } from "@vueuse/core";

const { width: windowWidth } = useWindowSize();
const menuWrapper = useTemplateRef("menu-wrapper");
const menu = useTemplateRef("menu");
const menuWidth = ref(0);

const showMobileMenu = ref(false);

const checkWidths = () => {
  const menuWrapperWidth = menuWrapper.value?.offsetWidth || 0;
  if (menuWrapperWidth <= menuWidth.value) {
    showMobileMenu.value = true;
  } else {
    showMobileMenu.value = false;
  }
};

onMounted(() => {
  menuWidth.value = menu.value?.offsetWidth || 0;
  checkWidths();
  window.addEventListener("resize", checkWidths);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", checkWidths);
});

watch(windowWidth, checkWidths);
</script>
