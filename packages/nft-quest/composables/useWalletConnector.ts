import { connect, type CreateConnectorFn, disconnect, getConnections, getConnectorClient, watchAccount, watchConnections } from "@wagmi/core";

export const useWalletConnector = () => {
  const { config, connector } = useConfig();
  const { updateAccount } = useAccountStore();

  const connections = ref(getConnections(config));

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
      // TODO: maybe check to see if an existing connection of zksync-account exists
      await connect(config, {
        connector: connector as CreateConnectorFn,
        chainId: config.chains[0].id,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Connection failed:", error);
    }
  };

  const getConnection = () => {
    return getConnections(config).find((connection) => connection.connector.type === "zksync-account");
  };

  const unsubscribeConnections = watchConnections(config, {
    onChange(data) {
      console.log("WalletConnector: updating connections", data);
      connections.value = data;
    },
  });
  onScopeDispose(() => unsubscribeConnections());

  const getClient = async () => {
    const connector = getConnection();
    console.log("Connector", connector);
    return await getConnectorClient(config, { connector: getConnection()!.connector });
  };

  const unsubscribe = watchAccount(config, {
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
  onScopeDispose(() => unsubscribe());

  return {
    logout,
    login,
    getConnection,
    getClient,
  };
};
