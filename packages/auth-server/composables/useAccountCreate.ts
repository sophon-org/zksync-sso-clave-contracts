import { toHex } from "viem";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import type { SessionData } from "zksync-sso";
import { deployAccount } from "zksync-sso/client";
import { registerNewPasskey } from "zksync-sso/client/passkey";

export const useAccountCreate = (_chainId: MaybeRef<SupportedChainId>) => {
  const chainId = toRef(_chainId);
  const { login } = useAccountStore();
  const { getThrowAwayClient } = useClientStore();

  const { inProgress: registerInProgress, execute: createAccount } = useAsync(async (session?) => {
    // Format passkey display name similar to "ZK SSO 11/11/2024 01:46 PM"
    let name = `ZK SSO ${(new Date()).toLocaleDateString("en-US")}`;
    name += ` ${(new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    const {
      credentialPublicKey,
      credentialId,
    } = await registerNewPasskey({
      userName: name,
      userDisplayName: name,
    });

    let sessionData: SessionData = session;
    const sessionKey = generatePrivateKey();
    if (session) {
      sessionData = {
        ...session,
        sessionPublicKey: privateKeyToAddress(sessionKey),
      };
    }

    const deployerClient = getThrowAwayClient({ chainId: chainId.value });

    const deployedAccount = await deployAccount(deployerClient, {
      credentialPublicKey,
      uniqueAccountId: credentialId,
      contracts: contractsByChain[chainId.value],
      paymasterAddress: contractsByChain[chainId.value].accountPaymaster,
      initialSession: sessionData || undefined,
    });

    login({
      username: credentialId,
      address: deployedAccount.address,
      passkey: toHex(credentialPublicKey),
    });

    return {
      address: deployedAccount.address,
      chainId: chainId.value,
      sessionKey: !session ? sessionKey : undefined,
    };
  });

  return {
    registerInProgress,
    createAccount,
  };
};
