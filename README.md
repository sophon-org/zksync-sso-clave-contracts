# ZKsync Account SDK

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE-MIT)
[![CI](https://github.com/matter-labs/zksync-account-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/matter-labs/zksync-account-sdk/actions/workflows/ci.yml)

This monorepo is comprised of the following packages/products:

- `packages/sdk` is the `zksync-account` JavaScript SDK
- `packages/gateway` is the Gateway used for default account creation and
  session key management
- `packages/contracts` are the on-chain smart contracts behind ZK Accounts

[Link to **ZK Account Interface Details**](https://matterlabs.notion.site/ZK-Account-Interface-Details-0c15bbcb90dc466ca826b57aa24d3a69)

## Running development

1. Install workspace dependencies with PNPM.

   ```bash
   pnpm install
   ```

2. Start up the Verdaccio proxy registry.

   ```bash
   pnpm nx local-registry
   ```

3. Publish the SDK package to your proxy registry.

   ```bash
   pnpm nx publish:local sdk
   ```

## Running commands

Use the NX CLI to run project commands, however PNPM is still usable as an
alternative. NX project names are based on the name defined in each project's
`project.json` which are set to match the directory name.

```bash
pnpm nx <target> <project>
# Example
pnpm nx build sdk
```

To run a command in multiple projects, use the `run-many` command.

```bash
pnpm nx run-many -t <target> --all           # for all projects
pnpm nx run-many -t <target> -p proj1 proj2  # by project
pnpm nx run-many --targets=lint,test,build   # run multiple commands
```

Some commands are inferred and built-in with NX. To review all the available
commands in a project:

```bash
pnpm nx show project <project> --web
```

## Lint project

At the root level of the monorepo, run the `lint` command to run linting across
the project.

To fix lint issues that come up from linting, run the `lint:fix` command.

## Running/Debugging End-to-End Tests

To execute the end-to-end tests for the `demo-app`, you'll need to do some
setup:

1. Start `era_test_node` (Separate terminal)
2. Deploy the smart contracts, `pnpm nx deploy contracts`

Once the local node is configured with the smart contracts deployed, you can run
the e2e tests:

```bash
pnpm nx e2e demo-app
```

To debug the end-to-end tests:

```bash
pnpm nx e2e:debug demo-app
```
