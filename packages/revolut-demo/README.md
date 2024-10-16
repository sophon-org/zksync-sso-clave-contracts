# Revolut demo

A Revolut ZKsync demo. This demo illustrates creating a ZKsync smart account and
logging in with a Passkey.

## Running the demo locally

Run the following command from the root of the monorepo:

```bash
pnpm nx dev revolut-demo
```

## "Resetting" the demo

Account session and data is stored via the browser Local storage.

1. When you need to restart the demo, delete the Local storage data via the Chrome
browser's Debug Tool. Open the Debug Tool, navigate to Application, right click
the Local storage entry for `http://localhost:3004` and click "Clear".

2. You will also need to delete the Passkey stored for the app. In the Chrome
browser, navigate to `chrome://settings/passkeys`. Click the settings button for
the entry for `localhost` and click "Delete".

## Deploying the Revolut demo to Firebase

The Revolut demo app uses Sepolia testnet for staging.

1. Edit the `nuxt.config.ts` with `revolutDemoDeployerKey` for an address in
Sepolia testnet that will be used for creating the demo crypto account.

2. Build the project with `pnpm nx build revolut-demo`.

3. Deploy the project to a preview channel on Firebase.

    ```bash
    npx firebase-tools@latest hosting:channel:deploy \
    <NAME_OF_PREVIEW_CHANNEL> \
    --only stake-demo-app  --expires 1d \
    --project stake-demo-app --json
    ```
