import { connect, createConfig, type CreateConnectorFn, disconnect, getAccount, http, reconnect, watchAccount } from "@wagmi/core";
import { zksyncInMemoryNode, zksyncLocalNode, zksyncSepoliaTestnet } from "@wagmi/core/chains";
import { type Address, type Hash, parseEther } from "viem";
import { zksyncAccountConnector } from "zksync-sso/connector";

export const useConnectorStore = defineStore("connector", () => {
  const runtimeConfig = useRuntimeConfig();
  const supportedChains = [
    zksyncSepoliaTestnet,
    zksyncInMemoryNode,
    zksyncLocalNode,
  ] as const;
  type SupportedChainId = (typeof supportedChains)[number]["id"];

  const connector = zksyncAccountConnector({
    metadata: {
      name: "ZK NFT Quest",
      icon: `${runtimeConfig.public.baseUrl}/favicon.svg`,
    },
    authServerUrl: runtimeConfig.public.authServerUrl,
    session: {
      fee: parseEther("0.1"),
      contractCalls: [{
        address: runtimeConfig.public.contracts.nft as Hash,
        function: "mint(address)",
      }],
    },
  });
  const wagmiConfig = createConfig({
    chains: supportedChains,
    connectors: [connector as CreateConnectorFn],
    transports: (Object.fromEntries(supportedChains.map((chain) => [chain.id, http()]))) as Record<SupportedChainId, ReturnType<typeof http>>,
  });

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
    const chain = supportedChains.filter((x) => x.id == runtimeConfig.public.chain.id)[0];
    if (!chain) throw new Error(`Chain with id ${runtimeConfig.public.chain.id} is missing from the supported chains list`);

    return await connect(wagmiConfig, {
      connector,
      chainId: chain.id,
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

  return {
    wagmiConfig: computed(() => wagmiConfig),
    account: computed(() => account.value),
    isConnected,
    connectAccount,
    disconnectAccount,
    address$,
    shortAddress,
  };
});
