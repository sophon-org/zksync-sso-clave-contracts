export const requestPassKey = async (username: string, name: string) => {
  if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable || !PublicKeyCredential.isConditionalMediationAvailable) {
    throw new Error("No platform authenticator available");
  }
  const results = await Promise.all([
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
    PublicKeyCredential.isConditionalMediationAvailable(),
  ]);
  if (!results.every((r) => r === true)) throw new Error("No platform authenticator available");

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: new Uint8Array(32),
      rp: {
        name: "account.zksync.io",
        id: "localhost",
      },
      user: {
        id: new Uint8Array(16),
        name: username,
        displayName: name,
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
      excludeCredentials: [],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        requireResidentKey: true,
      },
    },
  });
  return credential;
};
