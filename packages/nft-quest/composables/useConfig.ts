import { defaultWagmiConfig } from "@web3modal/wagmi/vue";
import { zksyncInMemoryNode } from "viem/chains";
import { zksyncAccountConnector } from "zksync-account/connector";

export const useConfig = () => {
  const projectId = "dde7b251fcfd7e11d5270497a053816e"; // TODO: Move to env

  const config = defaultWagmiConfig({
    chains: [zksyncInMemoryNode],
    projectId,
    appName: "ZKsync SSO Demo",
    connectors: [
      zksyncAccountConnector({
        metadata: {
          name: "ZKsync SSO Demo",
          icon: "http://localhost:3006/favicon.ico",
        },
        gatewayUrl: "http://localhost:3002/confirm",
        session: {
          expiresAt: (Date.now() + 1000 * 60 * 60 * 24).toString(), // Expires in 24 hours (1 day) from now
          spendLimit: {
            ["0x000000000000000000000000000000000000800A"]: "1000000000000000000",
          },
        },
      }),
    ],
  });

  return { config, projectId };
};
