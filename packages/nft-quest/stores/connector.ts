import { connect, createConfig, type CreateConnectorFn, disconnect, getAccount, http, reconnect, watchAccount } from "@wagmi/core";
import type { Address } from "viem";
import { zksyncInMemoryNode } from "viem/zksync";
import { zksyncAccountConnector } from "zksync-account/connector";

export const supportedChains = [zksyncInMemoryNode] as const;
export type SupportedChainId = (typeof supportedChains)[number]["id"];

const connector = zksyncAccountConnector({
  metadata: {
    name: "ZK NFT Quest",
    icon: "http://localhost:3006/favicon.svg",
  },
  gatewayUrl: "http://localhost:3002/confirm",
});
export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [connector as CreateConnectorFn],
  transports: (Object.fromEntries(supportedChains.map((chain) => [chain.id, http()]))) as Record<SupportedChainId, ReturnType<typeof http>>,
});

export const useConnectorStore = defineStore("connector", () => {
  const account = ref(getAccount(wagmiConfig));
  const isConnected = computed(() => account.value.isConnected);
  const address = computed(() => account.value.address);
  reconnect(wagmiConfig);

  watchAccount(wagmiConfig, {
    onChange: async (updatedAccount) => {
      account.value = updatedAccount;
    },
  });

  const connectAccount = async () => {
    await connect(wagmiConfig, {
      connector,
      chainId: supportedChains[0].id,
    });
  };

  const disconnectAccount = () => {
    disconnect(wagmiConfig);
  };

  const shortAddress = computed(() => {
    if (!address.value) return null;
    return useTruncateAddress(address.value);
  });

  const { subscribe: address$, notify: notifyOnAccountChange } = useObservable<Address | undefined>();
  watch(address, (newAddress) => {
    notifyOnAccountChange(newAddress);
  });

  // const getPublicClient = ({ chainId }: { chainId: SupportedChainId }) => {
  //   // const chain = supportedChains.find((c) => c.id === chainId);
  //   if (!chain) throw new Error(`Chain with id ${chainId} not found`);
  //   return createPublicClient({
  //     chain,
  //     transport: http(),
  //   });
  // };

  return {
    account: computed(() => account.value),
    isConnected,
    connectAccount,
    disconnectAccount,
    address$,
    shortAddress,
    // getPublicClient,
  };
});
