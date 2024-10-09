import type { CaipNetwork } from "@reown/appkit";
import { zksyncInMemoryNode } from "wagmi/chains";

export const useNetworks = () => {
  const devMode = import.meta.dev;
  const networks: Array<CaipNetwork> = [];

  if (devMode) {
    networks.push({
      id: "eip155:260",
      chainId: "260",
      name: "ZKsync In Memory Node",
      chainNamespace: "eip155",
      currency: "ETH",
      explorerUrl: "",
      rpcUrl: zksyncInMemoryNode.rpcUrls.default.http[0],
    });
  }

  return networks;
};
