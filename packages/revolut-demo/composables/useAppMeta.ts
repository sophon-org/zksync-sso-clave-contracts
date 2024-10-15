import { useStorage } from "@vueuse/core";
import type { Address } from "viem";

export interface AppMetadata {
  name: string;
  icon: string | null;
  credentialPublicKey: string | null;
  cryptoAccountAddress: `0x${string}` | null;
  hasCompletedInitialTransfer: boolean;
  hasCompletedAaveStake: boolean;
  cryptoBalance: string;
}

export const useAppMeta = () => {
  const appMetaStorage = useStorage<AppMetadata>("app-meta", {
    name: "",
    icon: null,
    // uint8 array
    credentialPublicKey: null,
    // account address that got created
    cryptoAccountAddress: null,
    // have you purchased any ETH
    hasCompletedInitialTransfer: false,
    // have you staked any ETH
    hasCompletedAaveStake: false,
    // not using it
    cryptoBalance: "0",
  });

  const config = useRuntimeConfig();
  return {
    appMeta: appMetaStorage,
    userDisplay: "Jane Doe",
    userRevTag: "jdoe",
    contracts: {
      accountFactory: config.public.accountFactory as Address,
      accountImplementation: config.public.accountImplementation as Address,
      passkey: config.public.passkey as Address,
      session: config.public.session as Address,
    },
    deployerKey: config.public.revolutDemoDeployerKey as Address,
    aaveAddress: config.public.aaveAddress as Address
  };
};
