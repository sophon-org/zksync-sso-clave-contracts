<template>
  <div class="h-full flex flex-col justify-center px-4">
    <div class="h-[40%] justify-center items-center flex flex-col">
      <div class="mx-auto mt-6 w-20 h-20 rounded-full bg-neutral-800">
        <img
          v-if="appMeta && appMeta.icon"
          :src="appMeta.icon"
          :alt="appMeta.name"
          class="h-full w-full object-cover rounded-full"
        >
      </div>
      <h1 class="text-white text-center text-2xl mt-4 font-semibold">
        Connect to {{ appMeta?.name }}
      </h1>
    </div>

    <div class="flex flex-col gap-5 mt-8 py-8">
      <div className="highlight">
        <div className="inner">
          <ZkButton
            class="w-full"
            :loading="registerInProgress"
            @click="createAccount"
          >
            Sign Up
          </ZkButton>
        </div>
      </div>

      <ZkButton
        type="secondary"
        class="!text-slate-400"
        :loading="loginInProgress"
        @click="connectToAccount"
      >
        Sign In
      </ZkButton>
    </div>

    <CommonHeightTransition :opened="!!accountDataFetchError || !!errorState">
      <p class="pt-3 text-sm text-error-300 text-center">
        <span
          v-if="accountDataFetchError"
        >
          {{ accountDataFetchError }}
        </span>
        <span v-else-if="errorState === 'account-not-found'">
          Account not found.
          <button
            type="button"
            class="underline underline-offset-4"
            @click="createAccount"
          >
            Sign up?
          </button>
        </span>
        <span v-else-if="passkeyError">
          {{ passkeyError }}
        </span>
      </p>
    </CommonHeightTransition>
  </div>
</template>

<script lang="ts" setup>
import { encodeFunctionData, getAddress, parseAbi, parseEther, toHex } from "viem";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { deployAccount } from "zksync-account/client";
import { registerNewPasskey } from "zksync-account/client/passkey";
import { getPasskeySignatureFromPublicKeyBytes } from "zksync-account/utils";

const { appMeta } = useAppMeta();
const { login } = useAccountStore();
const { getRichWalletClient, getPublicClient } = useClientStore();
const { requestChain } = storeToRefs(useRequestsStore());

const username = ref("");

const { accountData, accountDataFetchInProgress, accountDataFetchError/* , fetchAccountData */ } = useFetchAccountData(
  username,
  computed(() => requestChain.value!.id),
);

const passkeyError = ref<string | undefined>(undefined);
const errorState = computed<"username-taken" | "account-not-found" | undefined>(() => {
  if (accountData.value) {
    return "username-taken";
  }
  if (username.value && !accountDataFetchInProgress.value && !accountData.value) {
    return "account-not-found";
  }
  return undefined;
});

const { inProgress: registerInProgress, execute: createAccount } = useAsync(async () => {
  let name = `ZK Auth ${(new Date()).toLocaleDateString("en-US")}`;
  if (requestChain.value!.id == 260) {
    // For local testing, append the time
    name += ` ${(new Date()).toLocaleTimeString("en-US")}`;
  }

  const {
    newCredentialPublicKey: credentialPublicKey,
    newCredentialId,
  } = await registerNewPasskey({
    userName: name,
    userDisplayName: name,
  });

  /* TODO: implement username check */
  /* await fetchAccountData();
  if (accountData.value) {
    return; // username is taken
  } */

  const deployerClient = getRichWalletClient({ chainId: requestChain.value!.id });
  const sessionKey = generatePrivateKey();
  const sessionPublicKey = privateKeyToAddress(sessionKey);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { address } = await deployAccount(deployerClient as any, {
    credentialPublicKey,
    uniqueAccountId: newCredentialId,
    /* TODO: Remove spend limit, right now deployment fails without initial data */
    initialSessions: [
      {
        sessionPublicKey,
        expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
        spendLimit: {
          "0x111C3E89Ce80e62EE88318C2804920D4c96f92bb": "10000",
        },
      },
    ],
    contracts: contractsByChain[requestChain.value!.id],
  });

  // TODO: Replace the cost of session key creation with a Paymaster
  await deployerClient.sendTransaction({
    to: address,
    value: parseEther("0.001"),
  });

  login({
    username: newCredentialId,
    address: address,
    passkey: toHex(credentialPublicKey),
    sessionKey,
  });
});

const { inProgress: loginInProgress, execute: connectToAccount } = useAsync(async () => {
  // TODO: Move a lot of this into the SDK
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(32),
      userVerification: "discouraged",
    },
  }) as PublicKeyCredential | null;
  if (!credential) throw new Error("No registered passkeys");

  // eslint-disable-next-line no-console
  console.log(credential.id);

  const publicClient = getPublicClient({ chainId: requestChain.value!.id });
  const data = await publicClient.call({
    data: encodeFunctionData({
      abi: parseAbi(["function accountMappings(string) view returns (address)"]),
      functionName: "accountMappings",
      args: [credential.id],
    }),

    to: contractsByChain[requestChain.value!.id].accountFactory,
  });

  console.log(data.data);
  const accountAddress = getAddress(data.data!.replace("0x000000000000000000000000", "0x"));
  console.log(accountAddress);
  const domain = window.location.origin;

  const lowerKeyHalfBytes = await publicClient.call({
    data: encodeFunctionData({
      abi: parseAbi(["function lowerKeyHalf(string,address) view returns (bytes32)"]),
      functionName: "lowerKeyHalf",
      args: [domain, accountAddress],
    }),
    to: contractsByChain[requestChain.value!.id].passkey,
  });

  const upperKeyHalfBytes = await publicClient.call({
    data: encodeFunctionData({
      abi: parseAbi(["function upperKeyHalf(string,address) view returns (bytes32)"]),
      functionName: "upperKeyHalf",
      args: [domain, accountAddress],
    }),
    to: contractsByChain[requestChain.value!.id].passkey,
  });
  console.log({ lowerKeyHalfBytes });
  console.log({ upperKeyHalfBytes });

  const maybePasskey = getPasskeySignatureFromPublicKeyBytes([lowerKeyHalfBytes.data!, upperKeyHalfBytes.data!]);
  console.log({ maybePasskey });

  login({
    username: credential.id,
    address: accountAddress,
    passkey: toHex(maybePasskey),
  });
});
</script>

<style scoped>
.highlight::before,
.highlight::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(
    45deg,
    #ff595e,
    #ffca3a,
    #8ac926,
    #1982c4,
    #6a4c93,
    #ff6700
  );
  background-size: 400%;
  z-index: -1;
  animation: glow 5s linear infinite;
  width: 100%;
  border-radius: 2rem;
}

.highlight::after {
  filter: blur(9px);
  transform: translate3d(0, 0, 0); /* For Safari */
}

.highlight {
  position: relative;
  border-radius: 2rem;
  padding: 4px;
}

.highlight .inner {
  border-radius: 4px;
}

@keyframes glow {
  0% {
    background-position: 0 0;
  }

  50% {
    background-position: 100% 0;
  }

  100% {
    background-position: 0 0;
  }
}
</style>
