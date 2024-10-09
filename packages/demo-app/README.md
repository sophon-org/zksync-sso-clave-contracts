# Demo App

This app demonstrates a basic use of the ZKsync SSO SDK and provides e2e test
coverage for the SDK.

## Requirements

You will need [Era In Memory Node](https://github.com/matter-labs/era-test-node)
for deploying contracts locally.

In a terminal, start up the Era In Memory Node with the command `era_test_node`.

## Setup

Run the following commands from the root of the monorepo.

```bash
pnpm install
```

Deploy contracts from the `contracts` workspace.

```bash
pnpm nx deploy contracts
```

Run both `gateway` and `demo-app` using NX.

```bash
pnpm nx run-many -t serve -p gateway demo-app
```

The output will list the localhost addresses for both running applications.
