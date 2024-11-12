import { toHex } from "viem";
import { deployAccount } from "zksync-sso/client";
import { registerNewPasskey } from "zksync-sso/client/passkey";

export const useAccountCreate = (_chainId: MaybeRef<SupportedChainId>) => {
  const chainId = toRef(_chainId);
  const { login } = useAccountStore();
  const { getThrowAwayClient } = useClientStore();

  const { inProgress: registerInProgress, execute: createAccount } = useAsync(async () => {
    let name = `ZK Auth ${(new Date()).toLocaleDateString("en-US")}`;
    if (import.meta.dev) {
      // For local testing, append the time
      name += ` ${(new Date()).toLocaleTimeString("en-US")}`;
    }

    const {
      credentialPublicKey,
      credentialId,
    } = await registerNewPasskey({
      userName: name,
      userDisplayName: name,
    });

    const deployerClient = getThrowAwayClient({ chainId: chainId.value });

    const { address } = await deployAccount(deployerClient, {
      credentialPublicKey,
      uniqueAccountId: credentialId,
      contracts: contractsByChain[chainId.value],
      paymasterAddress: contractsByChain[chainId.value].accountPaymaster,
    });

    login({
      username: credentialId,
      address: address,
      passkey: toHex(credentialPublicKey),
    });
  });

  return {
    registerInProgress,
    createAccount,
  };
};
