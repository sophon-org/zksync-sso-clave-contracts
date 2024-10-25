import { useStorage } from "@vueuse/core";
import { getBalance } from "@wagmi/core";
import type { Chain } from "viem";

type AccountData = {
  address: `0x${string}` | undefined;
  chain: Chain | undefined;
  chainId: number | undefined;
  status: "connected" | "disconnected";
};

export const useAccountStore = defineStore("account", () => {
  const { config } = useConfig();
  const accountData = useStorage<AccountData>("account", {
    address: undefined,
    chain: undefined,
    chainId: undefined,
    status: "disconnected",
  }, undefined, {
    mergeDefaults: true,
  });
  const address = computed(() => accountData.value?.address || null);
  const isLoggedIn = computed(() => accountData.value?.status === "connected");
  // const isLoggedIn = computed(() => !!address.value);
  const updateAccount = (data: Partial<AccountData>) => {
    accountData.value = {
      ...accountData.value,
      ...data,
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
    // isConnected,
    balance,
  };
});
