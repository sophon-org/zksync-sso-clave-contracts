import { type Address, parseEther, toHex } from "viem";
import { deployAccount } from "zksync-sso/client";
import { registerNewPasskey } from "zksync-sso/client/passkey";

import { useAccountFetch } from "./useAccountFetch";

export async function useAccountRegistration(_username: MaybeRef<string>) {
  const username = toRef(_username);
  const { getThrowAwayClient } = useClientStore();
  const runtimeConfig = useRuntimeConfig();
  const chainId = runtimeConfig.public.chain.id as SupportedChainId;
  const { login } = useAccountStore();

  const {
    status: registerInProgress,
    execute: createAccount,
    error: registerError,
  } = await useAsyncData(async () => {
    const { accountData, fetchAccountData } = await useAccountFetch("registration", username, chainId);
    const runtimeConfig = useRuntimeConfig();
    await fetchAccountData();
    if (accountData.value) {
      throw new Error("Username is taken.");
    }

    const { newCredentialPublicKey } = await registerNewPasskey({
      userName: username.value,
      userDisplayName: username.value,
    }).catch(() => {
      throw new Error("Failed to register new passkey.");
    });

    const deployerClient = getThrowAwayClient({ chainId: chainId });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { address } = await deployAccount(deployerClient as any, {
      credentialPublicKey: newCredentialPublicKey,
      uniqueAccountId: username.value,
      contracts: contractsByChain[chainId],
      paymasterAddress: runtimeConfig.public.paymaster as Address,
    }).catch(() => {
      throw new Error("Failed to create a new account.");
    });

    await deployerClient.sendTransaction({
      to: address,
      value: parseEther("1"),
    }).catch(() => {
      throw new Error("Failed to send transaction.");
    });

    login({
      username: username.value,
      address: address,
      passkey: toHex(newCredentialPublicKey),
    });

    return true;
  }, {
    immediate: false,
  });

  return {
    registerInProgress,
    registerError,
    createAccount,
  };
}
