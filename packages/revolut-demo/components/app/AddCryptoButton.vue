<template>
  <ZkButton type="primary" @click="createCryptoAccount">Add Crypto account</ZkButton>
</template>

<script setup lang="ts">
import { createWalletClient, http, type Address, type Chain } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { deployAccount } from "zksync-account/client";
import { registerNewPasskey } from "zksync-account/client/passkey";

const { appMeta, userDisplay, userRevTag, contracts, deployerKey } = useAppMeta();

const u8ToString = (input: Uint8Array): string => {
  const str = JSON.stringify(Array.from ? Array.from(input) : [].map.call(input, (v => v)));
  // console.log("String version");
  // console.log(str);
  return str;
};

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
        credentialPublicKey: u8ToString(newCredentialPublicKey),
      };
      credentialPublicKey = newCredentialPublicKey;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Passkey registration failed:", error);
      return;
    }
  } else {
    credentialPublicKey = new Uint8Array(JSON.parse(appMeta.value.credentialPublicKey));
  }
  const config = useRuntimeConfig();
  const deployerClient = createWalletClient({
    account: privateKeyToAccount(deployerKey as Address),
    chain: config.public.network as Chain,
    transport: http()
  });
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
  navigateTo("/crypto-account");
};
</script>
