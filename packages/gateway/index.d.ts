import type { Address } from "viem";

declare module "nuxt/schema" {
  interface PublicRuntimeConfig {
    contracts: {
      paymaster: Address;
    };
  }
}

export {};
