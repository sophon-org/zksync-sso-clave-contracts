import { defineNuxtConfig } from "nuxt/config";
import type { NuxtPage } from "nuxt/schema";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-07-08",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@pinia/nuxt", "@nuxtjs/tailwindcss", "@nuxtjs/google-fonts", "@vueuse/nuxt", "radix-vue/nuxt", "@nuxtjs/color-mode"],

  ssr: false,
  devServer: {
    port: 3002,
  },
  css: ["@/assets/css/tailwind.css", "@/assets/css/style.scss", "web3-avatar-vue/dist/style.css"],
  googleFonts: {
    families: {
      Inter: [400, 500, 600, 700],
    },
  },
  eslint: {
    config: {
      stylistic: {
        indent: 2,
        semi: true,
        quotes: "double",
        arrowParens: true,
        quoteProps: "as-needed",
        braceStyle: "1tbs",
      },
    },
  },
  runtimeConfig: {
    public: {
      reownId: "489989b3cade8c4769610010f741bc8b",
      chains: {
        zkSyncInMemoryNode: {
          id: 260,
          name: "ZKsync InMemory Node",
          network: "zksync-in-memory-node",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: "http://localhost:8011",
          testnet: true,

        },
      },
    },
  },
  hooks: {
    // https://deltener.com/blog/nuxt-enterprise-patterns-component-management/
    "pages:extend"(pages) {
      const pagesToRemove: NuxtPage[] = [];
      pages.forEach((page) => {
        if (page.path.includes("components")) pagesToRemove.push(page);
      });

      pagesToRemove.forEach((page: NuxtPage) => {
        pages.splice(pages.indexOf(page), 1);
      });
    },
  },
  components: [
    "~/components", {
      path: "~/pages",
      pattern: "*/components/**",
      pathPrefix: false,
    },
  ],
});
