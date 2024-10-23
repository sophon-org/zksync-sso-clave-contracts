import { disconnect, getConnections, watchAccount } from "@wagmi/core";
import { createWeb3Modal } from "@web3modal/wagmi/vue";

export const useWalletConnector = () => {
  const { config, projectId } = useConfig();
  const { updateAccount } = useAccountStore();

  const web3modal = createWeb3Modal({ wagmiConfig: config, projectId });

  const logout = async () => {
    const connections = getConnections(config);

    if (connections.length) {
      await disconnect(config);
    }
    updateAccount({
      address: undefined,
      addresses: undefined,
      chain: undefined,
      chainId: undefined,
      status: "disconnected",
    });
  };

  const login = async () => {
    try {
      await web3modal.open();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Connection failed:", error);
    }
  };

  watchAccount(config, {
    async onChange(data) {
      if (data.status === "connected") {
        updateAccount(data);
      } else {
        updateAccount({
          address: undefined,
          addresses: undefined,
          chain: undefined,
          chainId: undefined,
          status: "disconnected",
        });
      }
    },
  });

  return {
    web3modal,
    logout,
    login,
  };
};
