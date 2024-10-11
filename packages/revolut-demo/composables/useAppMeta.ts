import { useStorage } from "@vueuse/core";
import type { Address } from "viem";

export interface AppMetadata {
  name: string;
  icon: string | null;
  credentialPublicKey: Uint8Array | null;
  cryptoAccountAddress: string | null;
  hasCompletedInitialTransfer: boolean;
  hasCompletedAaveStake: boolean;
  cryptoBalance: string;
}

export const useAppMeta = () => {
  const appMetaStorage = useStorage<AppMetadata>("app-meta", {
    name: "",
    icon: null,
    credentialPublicKey: null,
    cryptoAccountAddress: null,
    hasCompletedInitialTransfer: false,
    hasCompletedAaveStake: false,
    cryptoBalance: "0",
  });

  return {
    appMeta: appMetaStorage,
    userDisplay: "Nicolas Villanueva",
    userRevTag: "nicolakwkm",
    contracts: {
      accountFactory: "0x23b13d016E973C9915c6252271fF06cCA2098885" as Address,
      accountImplementation: "0x6cd5A2354Be0E656e7A1E94F1C0570E08EC4789B" as Address,
      passkey: "0x455e8d86DC6728396f8d3B740Fc893F4E20b25Dc" as Address,
      session: "0x476F23ef274F244282252341792c8a610feF78ee" as Address,
    },
    richAccountPrivateKey: "0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e", // Rich Account 0
    aaveAddress: "0xE90E12261CCb0F3F7976Ae611A29e84a6A85f424", // Rich Account 9
  };
};
