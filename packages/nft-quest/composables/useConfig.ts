import { type Config, createConfig, type CreateConnectorFn, http } from "@wagmi/core";
import type { Chain } from "viem";
import { zksyncAccountConnector } from "zksync-account/connector";

export const useConfig = (): { config: Config; connector: CreateConnectorFn } => {
  const runtimeConfig = useRuntimeConfig();
  const chain = runtimeConfig.public.chain as Chain;
  const connector: CreateConnectorFn = zksyncAccountConnector({
    metadata: {
      name: "ZKsync NFT Demo",
      icon: "http://localhost:3006/favicon.ico",
    },
    session: {
      expiresAt: (Date.now() + 1000 * 60 * 60 * 24).toString(), // Expires in 24h
      spendLimit: {
        ["0x000000000000000000000000000000000000800A"]: "1000000000000000000",
      },
    },
  });

  const config: Config = createConfig({
    chains: [chain],
    connectors: [connector],
    transports: (Object.fromEntries([chain].map((chain) => [chain.id, http()]))) as Record<(typeof chain)["id"], ReturnType<typeof http>>,
  });

  return { config, connector };
};
