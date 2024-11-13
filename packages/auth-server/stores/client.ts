import { type Address, createPublicClient, createWalletClient, http, publicActions, walletActions } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { zksyncInMemoryNode, zksyncSepoliaTestnet } from "viem/chains";
import { eip712WalletActions } from "viem/zksync";
import { createZksyncPasskeyClient, type PasskeyRequiredContracts } from "zksync-sso/client/passkey";

export const supportedChains = [zksyncSepoliaTestnet, zksyncInMemoryNode];
export type SupportedChainId = (typeof supportedChains)[number]["id"];
export const blockExplorerUrlByChain: Record<SupportedChainId, string> = {
  [zksyncSepoliaTestnet.id]: zksyncSepoliaTestnet.blockExplorers.native.url,
  [zksyncInMemoryNode.id]: "http://localhost:3010",
};
export const blockExplorerApiByChain: Record<SupportedChainId, string> = {
  [zksyncSepoliaTestnet.id]: zksyncSepoliaTestnet.blockExplorers.native.blockExplorerApi,
  [zksyncInMemoryNode.id]: "http://localhost:3020",
};

type ChainContracts = PasskeyRequiredContracts & {
  accountFactory: NonNullable<PasskeyRequiredContracts["accountFactory"]>;
  accountPaymaster: Address;
};
export const contractsByChain: Record<SupportedChainId, ChainContracts> = {
  [zksyncSepoliaTestnet.id]: {
    session: "0x64AEB39926631F9601D78E3024D32632564C057B",
    passkey: "0x7AC1718A54372B5D5fDAca2B7aB6dC6019078d20",
    accountFactory: "0x61D9223bb1016e3964Fc45091c305499A8fBF6fE",
    accountPaymaster: "0x6Fd62E75677B9ca777d0dfA0D075707347634EEA",
  },
  [zksyncInMemoryNode.id]: {
    session: "0xc81BdB6e98da8e23aa646969A7e942752b9B10c4",
    passkey: "0x07734BA326b6AD13BfC0115b0903EB14268F1617",
    accountFactory: "0xaAF5f437fB0524492886fbA64D703df15BF619AE",
    accountPaymaster: "0x25f2725637E9340E8f2a59eCb92F5fE0dA8e8573",
  },
};

export const useClientStore = defineStore("client", () => {
  const { address, username, passkey } = storeToRefs(useAccountStore());

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
      paymasterAddress: contracts.accountPaymaster,
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
