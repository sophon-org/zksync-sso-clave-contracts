import type { Address } from "viem";

declare module "nuxt/schema" {
  interface PublicRuntimeConfig {
    paymaster: Address;
  }
}

export {};
