import { type Address, createPublicClient, createWalletClient, http, publicActions, walletActions } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { zksync, zksyncInMemoryNode, zksyncLocalNode, zksyncSepoliaTestnet } from "viem/chains";
import { eip712WalletActions } from "viem/zksync";
import { createZksyncPasskeyClient, type PasskeyRequiredContracts } from "zksync-sso/client/passkey";

export const supportedChains = [zksync, zksyncSepoliaTestnet, zksyncInMemoryNode, zksyncLocalNode];
export type SupportedChainId = (typeof supportedChains)[number]["id"];
export const blockExplorerApiByChain: Record<SupportedChainId, string> = {
  [zksync.id]: zksync.blockExplorers.native.apiUrl,
  [zksyncSepoliaTestnet.id]: zksyncSepoliaTestnet.blockExplorers.native.blockExplorerApi,
  [zksyncInMemoryNode.id]: "http://localhost:8011",
  [zksyncLocalNode.id]: "http://localhost:8011",
};

type ChainContracts = PasskeyRequiredContracts & {
  accountFactory: NonNullable<PasskeyRequiredContracts["accountFactory"]>;
};
export const contractsByChain: Record<SupportedChainId, ChainContracts> = {
  [zksync.id]: {
    session: "0x",
    passkey: "0x",
    accountFactory: "0x",
  },
  [zksyncSepoliaTestnet.id]: {
    session: "0x64AEB39926631F9601D78E3024D32632564C057B",
    passkey: "0x7AC1718A54372B5D5fDAca2B7aB6dC6019078d20",
    accountFactory: "0xE1942367Ce898eF34743ee206C9D25225eFA8d77",
  },
  [zksyncLocalNode.id]: {
    session: "0x",
    passkey: "0x",
    accountFactory: "0x",
  },
  [zksyncInMemoryNode.id]: {
    session: "0xCfcCD82F2fA50d86e8C91c1cE75f6935806Ae4D2",
    passkey: "0x07734BA326b6AD13BfC0115b0903EB14268F1617",
    accountFactory: "0xaAF5f437fB0524492886fbA64D703df15BF619AE",
  },
};

export const useClientStore = defineStore("client", () => {
  const { address, username, passkey } = storeToRefs(useAccountStore());
  const runtimeConfig = useRuntimeConfig();

  const getPublicClient = ({ chainId }: { chainId: SupportedChainId }) => {
    const chain = supportedChains.find((chain) => chain.id === chainId);
    if (!chain) throw new Error(`Chain with id ${chainId} is not supported`);

    const client = createPublicClient({
      chain,
      transport: http(),
    });

    return client;
  };

  const getClient = ({ chainId }: { chainId: SupportedChainId }) => {
    if (!address.value) throw new Error("Address is not set");
    const chain = supportedChains.find((chain) => chain.id === chainId);
    if (!chain) throw new Error(`Chain with id ${chainId} is not supported`);
    const contracts = contractsByChain[chainId];

    const client = createZksyncPasskeyClient({
      address: address.value,
      credentialPublicKey: passkey.value!,
      userName: username.value!,
      userDisplayName: username.value!,
      contracts,
      paymasterAddress: runtimeConfig.public.paymaster as Address,
      chain: chain,
      transport: http(),
    });

    return client;
  };

  const getThrowAwayClient = ({ chainId }: { chainId: SupportedChainId }) => {
    const chain = supportedChains.find((chain) => chain.id === chainId);
    if (!chain) throw new Error(`Chain with id ${chainId} is not supported`);

    const throwAwayClient = createWalletClient({
      account: privateKeyToAccount(generatePrivateKey()),
      chain,
      transport: http(),
    })
      .extend(publicActions)
      .extend(walletActions)
      .extend(eip712WalletActions());
    return throwAwayClient;
  };

  return {
    getPublicClient,
    getClient,
    getThrowAwayClient,
  };
});
