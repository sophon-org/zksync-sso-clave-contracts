
declare module "nuxt/schema" {
  interface PublicRuntimeConfig {
    aaveAddress: `0x${string}`;
    revolutDemoDeployerKey: `0x${string}`;
    network: zksyncInMemoryNode | zksyncSepoliaTestnet;
    accountFactory: `0x${string}`;
    accountImplementation: `0x${string}`;
    passkey: `0x${string}`;
    session: `0x${string}`;
  }
}

export {};
