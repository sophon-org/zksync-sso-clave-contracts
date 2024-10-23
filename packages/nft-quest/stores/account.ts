import { useStorage } from "@vueuse/core";
import { type Config, type GetAccountReturnType, getBalance } from "@wagmi/core";
import type { Chain } from "viem";

type AccountData = {
  address: `0x${string}` | undefined;
  addresses: readonly `0x${string}`[] | undefined;
  chain: Chain | undefined;
  chainId: number | undefined;
  status: "connected" | "disconnected";
};

export const useAccountStore = defineStore("account", () => {
  const { config } = useConfig();
  const accountData = useStorage<AccountData>("account", {
    address: undefined,
    addresses: undefined,
    chain: undefined,
    chainId: undefined,
    status: "disconnected",
  }, undefined, {
    mergeDefaults: true,
  });
  const address = computed(() => accountData.value?.address || null);
  const isLoggedIn = computed(() => !!address.value && accountData.value?.status === "connected");
  const updateAccount = (data: Partial<GetAccountReturnType<Config>>) => {
    accountData.value = {
      address: data.address,
      addresses: data.addresses,
      chain: data.chain,
      chainId: data.chainId,
      status: data.status === "connected" ? "connected" : "disconnected",
    };
  };

  const balance = computedAsync(
    async () => {
      if (!address.value) return null;

      const currentBalance = await getBalance(config, {
        address: address.value,
      });

      return `${currentBalance.formatted} ${currentBalance.symbol}`;
    },
    null,
  );

  const shortAddress = computed(() => {
    if (!address.value) return null;
    return useTruncateAddress(address.value);
  });

  return {
    address,
    shortAddress,
    updateAccount,
    isLoggedIn,
    balance,
  };
});
