import type { Address, Chain } from "viem";

declare module "nuxt/schema" {
  interface PublicRuntimeConfig {
    chain: Chain;
    paymaster: Address;
  }
}

export {};
