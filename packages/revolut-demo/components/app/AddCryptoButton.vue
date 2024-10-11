<template>
  <ZkButton type="primary" @click="createCryptoAccount">Add Crypto account</ZkButton>
</template>

<script setup lang="ts">
import { createWalletClient, http, type Address } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { zksyncInMemoryNode } from 'viem/zksync';
import { deployAccount } from 'zksync-account/client';
import { registerNewPasskey } from 'zksync-account/client/passkey';

const { appMeta, userDisplay, userRevTag, contracts, richAccountPrivateKey } = useAppMeta();
const { push } = useRouter();

const createCryptoAccount = async () => {
  let credentialPublicKey: Uint8Array;

  // Create new Passkey
  if (!appMeta.value || !appMeta.value.credentialPublicKey) {
    try {
      const { newCredentialPublicKey } = await registerNewPasskey({
        userDisplayName: userDisplay, // Display name of the user
        userName: userRevTag, // User's Revtag
      });
      appMeta.value = {
        ...appMeta.value, // Preserve existing metadata like name/icon
        credentialPublicKey: newCredentialPublicKey,
      };
      credentialPublicKey = newCredentialPublicKey;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Passkey registration failed:", error);
      return;
    }
  } else {
    credentialPublicKey = appMeta.value.credentialPublicKey;
  }

  const deployerClient = createWalletClient({
    // Rich Account 0
    account: privateKeyToAccount(richAccountPrivateKey as Address),
    chain: zksyncInMemoryNode,
    transport: http()
  })
  const sessionKey = generatePrivateKey();
  const sessionPublicKey = privateKeyToAccount(sessionKey).address;

  try {
    const { address } = await deployAccount(deployerClient, {
      credentialPublicKey,
      initialSessions: [
          {
            sessionPublicKey,
            expiresAt: (new Date(Date.now() + 1000 * 60 * 60 * 24)).toISOString(), // 1 day expiry
            spendLimit: {
                ["0x000000000000000000000000000000000000800A"]: "1000", // ETH
            },
          },
      ],
      contracts: contracts,
    });
  
    appMeta.value = {
      ...appMeta.value,
      cryptoAccountAddress: address,
    };
  } catch (error) {
    console.error(error);
    return;
  }

  console.log("Successfully created the account");
  push("/crypto-account");
};
</script>
