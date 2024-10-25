import type { zksyncInMemoryNode, zksyncNode } from "viem/chains";

declare module "nuxt/schema" {
  interface PublicRuntimeConfig {
    chain: zksyncInMemoryNode | zksyncNode;
    contracts: {
      nft: `0x${string}`;
      paymaster: `0x${string}`;
    };
  }
}
// It is always important to ensure you import/export something when augmenting a type
export {};
