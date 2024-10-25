import { connect, type CreateConnectorFn, disconnect, watchAccount } from "@wagmi/core";

export const useWalletConnector = () => {
  const { config, connector } = useConfig();
  const { updateAccount } = useAccountStore();

  const logout = async () => {
    disconnect(config);
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
      connect(config, {
        connector: connector as CreateConnectorFn,
        chainId: config.chains[0].id,
      });
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
    logout,
    login,
  };
};
