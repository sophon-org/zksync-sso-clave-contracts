import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit, useAppKit } from "@reown/appkit/vue";
import { zksyncAccountConnector } from "zksync-account/connector";
import { walletConnect, injected } from "wagmi/connectors";
import type { CreateConnectorFn } from "wagmi";
import { useNetworks } from "./useNetworks";

export const useConfig = () => {
  const runtimeConfig = useRuntimeConfig();
  const projectId = runtimeConfig.public.reownId;
  const networks = useNetworks();

  const metadata = {
    name: "ZKsync SSO Demo",
    description: "A Demo of the ZKsync Smart Sign-On",
    url: "http://localhost:3002",
    icons: ["https://zksync.io/favicon.ico"],
  };

  const connectors: CreateConnectorFn[] = [];
  connectors.push(walletConnect({ projectId, metadata, showQrModal: false })); // showQrModal must be false
  connectors.push(injected({ shimDisconnect: true }));

  connectors.push(
    zksyncAccountConnector({
      metadata: {
        name: "ZKsync SSO Demo",
        icon: "http://localhost:3004/favicon.ico",
      },
      gatewayUrl: "http://localhost:3002/confirm",
      session: {
        expiresAt: (Date.now() + 1000 * 60 * 60 * 24).toString(), // Expires in 24 hours (1 day) from now
        spendLimit: {
          ["0x000000000000000000000000000000000000800A"]: "1000000000000000000",
        },
      },
    }) as CreateConnectorFn,
  );

  const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks,
    connectors,
  });
  const config = wagmiAdapter.wagmiConfig;

  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    metadata,
    projectId,
    allWallets: "HIDE",
    features: {
      email: false,
      socials: [],
    },
    enableWalletConnect: false,
    featuredWalletIds: ["zksyncAccount"],
    termsConditionsUrl: "https://zksync.io/terms",
    privacyPolicyUrl: "https://zksync.io/privacy",
  });

  const modal = useAppKit();

  return { modal, config };
};
