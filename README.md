# zksync smart accounts

This project is setup using pnpm with workspaces.
NX is added to help with tasks and caching.

For a quick rundown:
[Setup a monorepo with PNPM workspaces and NX](https://www.youtube.com/watch?v=ngdoUQBvAjo)

## 💻 Development

Install dependencies with `pnpm install`.

### Running workspace projects

To run a workspace project, you can still use the normal pnpm commands.
To incorporate NX in the process, run commands using nx instead.

```sh
npx nx serve <project>
```

## 🧰 Tasks

### Viewing workspace project tasks

To view the available tasks that nx provides for a workspace project,
run the following:

```sh
npx nx show project <project>
```

### View dependencies

To view the dependencies between projects,
run the nx command:

```sh
npx nx graph
```

## 🚀 Releasing projects (WIP)

To release projects:

```sh
npx nx release
```

To learn how to publish libraries, see [Manage
releases](https://nx.dev/core-features/manage-releases).
