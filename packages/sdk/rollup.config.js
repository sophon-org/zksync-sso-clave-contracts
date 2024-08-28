const { withNx } = require("@nx/rollup/with-nx");

module.exports = withNx(
  {
    main: "./src/index.ts",
    additionalEntryPoints: [
      "./src/connector.ts",
      "./src/client-gateway.ts",
      "./src/client.ts",
      "./src/communicator.ts",
      "./src/errors.ts",
    ],
    external: [
      "@simplewebauthn/browser",
      "@simplewebauthn/server",
      "@wagmi/core",
      "viem",
      "eventemitter3",
    ],
    generateExportsField: true,
    outputPath: "../../dist/packages/sdk",
    tsConfig: "./tsconfig.lib.json",
    compiler: "swc",
    format: ["cjs", "esm"],
    assets: [{ input: ".", output: ".", glob: "*.md" }],
  },
  {
    // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
    // e.g.
    // output: { sourcemap: true },
    // input: {
    //   index: "src/index.ts",
    //   "connector/index": "src/connector/index.ts",
    //   "client-gateway/index": "src/client-gateway/index.ts",
    //   "client/index": "src/client/index.ts",
    //   "communicator/index": "src/communicator/index.ts",
    //   "errors/index": "src/errors/index.ts",
    // },
  },
);
