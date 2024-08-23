import { StorageSerializers, useStorage } from "@vueuse/core";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zksync, zksyncSepoliaTestnet } from "viem/chains";

import type { Hash } from "viem";

type SmartAccount = {
  // temporary just private key
  privateKey: Hash;
};

export const supportedChains = [zksync, zksyncSepoliaTestnet];
export const blockExplorerApiByChain: Record<number, string> = {
  [zksync.id]: zksync.blockExplorers.native.apiUrl,
  [zksyncSepoliaTestnet.id]:
    zksyncSepoliaTestnet.blockExplorers.native.blockExplorerApi,
};

export const useAccountStore = defineStore("account", () => {
  const accountData = useStorage<SmartAccount | null>(
    "account",
    null,
    undefined,
    {
      serializer: StorageSerializers.object,
    },
  );
  const login = (data: SmartAccount) => {
    accountData.value = data;
  };
  const logout = () => {
    accountData.value = null;
  };

  let account: ReturnType<typeof privateKeyToAccount> | null = null;
  const address = ref<Hash | null>(null);
  const isLoggedIn = computed(() => !!address.value);

  const createAccount = () => {
    if (!accountData.value) throw new Error("No account data");
    account = privateKeyToAccount(accountData.value.privateKey);
    address.value = account.address;
  };
  const destroyAccount = () => {
    account = null;
    address.value = null;
  };
  watch(
    accountData,
    (data) => {
      if (data) createAccount();
      else destroyAccount();
    },
    { immediate: true },
  );

  const getWalletClient = ({ chainId }: { chainId: number }) => {
    if (!account) throw new Error("No account data");
    const chain
      = supportedChains.find((chain) => chain.id === chainId)
      || supportedChains[0];
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    }).extend(publicActions);
    return walletClient;
  };
  const createSessionKey = async () => {
    if (!accountData.value) throw new Error("No account data");
    return await Promise.resolve(accountData.value.privateKey);
  };

  return {
    address,
    isLoggedIn,
    getWalletClient,
    createSessionKey,
    login,
    logout,
  };
});
