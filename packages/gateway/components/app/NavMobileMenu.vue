<template>
  <client-only>
    <Dialog.Root>
      <Dialog.Trigger>
        <zk-button-icon icon="menu" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          class="data-[state=open]:animate-overlayShow fixed inset-0 z-30 bg-neutral-950/90"
        />
        <Dialog.Content
          class="data-[state=open]:animate-slideDownAndFade fixed top-0 left-0 right-0 w-full rounded-zk bg-white focus:outline-none z-[100] p-4 dark:bg-neutral-950 border border-transparent dark:border-neutral-800 dark:text-neutral-100"
        >
          <Dialog.Title class="text-lg flex items-center mb-8">
            <span class="flex-auto">Menu</span>
            <app-color-mode />
            <Dialog.Close
              class="ml-2 p-2 inline-flex appearance-none items-center justify-center focus:outline-none focus:ring-1 rounded-full"
              aria-label="Close"
            >
              <zk-icon icon="close" />
            </Dialog.Close>
          </Dialog.Title>
          <Dialog.Description class="mb-10 text-lg text-center">
            <slot />
          </Dialog.Description>

          <div class="flex flex-col gap-2 justify-end">
            <Dialog.Close as-child>
              <zk-button
                type="primary"
                class="w-full"
                :ui="{ button: 'justify-start py-2' }"
              >
                <template #prefix>
                  <zk-icon icon="dashboard" />
                </template>
                Dashboard
              </zk-button>
            </Dialog.Close>
            <Dialog.Close as-child>
              <zk-button
                type="secondary"
                class="w-full"
                :ui="{ button: 'justify-start py-2' }"
              >
                <template #prefix>
                  <zk-icon icon="settings" />
                </template>
                Settings
              </zk-button>
            </Dialog.Close>
            <Dialog.Close as-child>
              <zk-button
                type="secondary"
                class="w-full"
                :ui="{ button: 'justify-start py-2' }"
              >
                <template #prefix>
                  <zk-icon icon="description" />
                </template>
                History
              </zk-button>
            </Dialog.Close>
            <Dialog.Close as-child>
              <zk-button
                type="secondary"
                class="w-full"
                :ui="{ button: 'justify-start py-2' }"
              >
                <template #prefix>
                  <zk-icon icon="grid_view" />
                </template>
                Marketplace
              </zk-button>
            </Dialog.Close>
            <Dialog.Close as-child>
              <zk-button
                type="secondary"
                class="w-full"
                :ui="{ button: 'justify-start py-2' }"
              >
                <template #prefix>
                  <zk-icon icon="link" />
                </template>
                Connections (4)
              </zk-button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </client-only>
</template>

<script setup lang="ts">
import { Dialog } from "radix-vue/namespaced";
</script>
