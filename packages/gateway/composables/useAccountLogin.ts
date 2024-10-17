export async function useAccountLogin() {
  return await useAsyncData("account-login", async () => {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(32),
        userVerification: "discouraged",
      },
    }).catch(() => {
      throw new Error("Passkey verification was interrupted. Please try again.");
    });
    if (!credential) throw new Error("There are no registered passkeys for this user.");

    console.log("Login not implemented yet");
    console.log("CREDENTIALS", credential);
    /* TODO: find account by credential.id */
  }, {
    immediate: false,
  });
}
