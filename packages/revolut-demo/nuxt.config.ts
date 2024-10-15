import { defineNuxtConfig } from "nuxt/config";
import { zksyncInMemoryNode, zksyncSepoliaTestnet } from "viem/chains";

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
  },
  runtimeConfig: {
    public: {
      aaveAddress: "0xE90E12261CCb0F3F7976Ae611A29e84a6A85f424", // Rich Account 9
      revolutDemoDeployerKey: "0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e", // Rich Account 0
      network: zksyncInMemoryNode,
      accountFactory: "0x23b13d016E973C9915c6252271fF06cCA2098885",
      accountImplementation: "0x6cd5A2354Be0E656e7A1E94F1C0570E08EC4789B",
      passkey: "0x455e8d86DC6728396f8d3B740Fc893F4E20b25Dc",
      session: "0x476F23ef274F244282252341792c8a610feF78ee"
    }
  },
  $production: {
    runtimeConfig: {
      public: {
        aaveAddress: "0x",
        revolutDemoDeployerKey: "0x",
        network: zksyncSepoliaTestnet,
        accountFactory: "0x",
        accountImplementation: "0x",
        passkey: "0x",
        session: "0x"
      }
    }
  }
});
