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
      session: "0x476F23ef274F244282252341792c8a610feF78ee",
      passkey: "0x455e8d86DC6728396f8d3B740Fc893F4E20b25Dc",
      accountFactory: "0x23b13d016E973C9915c6252271fF06cCA2098885",
      accountImplementation: "0x6cd5A2354Be0E656e7A1E94F1C0570E08EC4789B",
    }
  },
  $production: {
    runtimeConfig: {
      public: {
        aaveAddress: "0x34847471630EEAB49c07Eb2EdABE773F4A0eaDf7",
        revolutDemoDeployerKey: "0x89b96a981c0943d67a01cfc73f3f07c96d7da5dd0ccfef4e65366cb25f62e80c",
        network: zksyncSepoliaTestnet,
        session: "0x5f8BA8B94Ed013D06a7A2Db8001E18D3b8b48C49",
        passkey: "0x4A417adBef9B8Cad98A1347AAd5FD63c89c56b33",
        accountFactory: "0x8A993b0E56bB3248AEeb9D83FaD3051AE7B937F1",
        accountImplementation: "0xf614017569f0cBD6d6D11b79bdfdf29C191ABE00",
      }
    }
  }
});
