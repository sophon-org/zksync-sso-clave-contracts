module.exports = (async () => {
  const baseConfig = await import("../../eslint.config.js").then((module) => module.default || module);
  return [
    { ignores: ["node_modules", "dist", "temp", "tmp", "tests", "test", "artifacts-zk", "cache-zk", "deployments-zk", "typechain-types"] },
    ...baseConfig,
  ];
})();
