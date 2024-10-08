import { defineNuxtConfig } from "nuxt/config";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  devtools: { enabled: true },
  modules: ["@nuxt/icon", "@vueuse/nuxt", "radix-vue/nuxt", "@nuxt/eslint", "@pinia/nuxt", "@nuxtjs/tailwindcss", "@nuxtjs/google-fonts"],
  ssr: false,
  googleFonts: {
    families: {
      Inter: [300, 400, 500, 600, 700],
    },
  },
  app: {
    head: {
      bodyAttrs: {
        class: "bg-khaki"
      }
    }
  }
});
