import { type Config, disconnect, getConnections, watchAccount } from "@wagmi/core";
import { createWeb3Modal } from "@web3modal/wagmi/vue";

const createModal = (config: Config, projectId: string) => {
  return createWeb3Modal({ wagmiConfig: config, projectId });
};

export const useWalletConnector = () => {
  const { config, projectId } = useConfig();
  const { updateAccount } = useAccountStore();

  const web3modal = createModal(config, projectId);

  const logout = async () => {
    const connections = getConnections(config);

    if (connections.length) {
      await disconnect(config);
    }
    updateAccount({
      address: undefined,
      chain: undefined,
      chainId: undefined,
      status: "disconnected",
    });
    navigateTo("/");
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
        updateAccount({
          address: data.address,
          chain: data.chain,
          chainId: data.chainId,
          status: "connected",
        });
      } else {
        updateAccount({
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
