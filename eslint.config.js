const globals = require("globals");
const { FlatCompat } = require("@eslint/eslintrc");
const js = require("@eslint/js");
const nxEslintPlugin = require("@nx/eslint-plugin");
const eslintConfigPrettier = require("eslint-config-prettier");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  { plugins: { "@nx": nxEslintPlugin } },
  {
    files: ["**/*.{ts,js,mjs,cjs}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
      "no-debugger": process.env.NODE_ENV === "production" ? "error" : "warn",
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: "*",
              onlyDependOnLibsWithTags: ["*"],
            },
          ],
        },
      ],
    },
  },
  ...compat.config({ extends: ["plugin:@nx/typescript"] }).map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      ...config.rules,
    },
  })),
  ...compat.config({ extends: ["plugin:@nx/javascript"] }).map((config) => ({
    ...config,
    files: ["**/*.js", "**/*.jsx"],
    rules: {
      ...config.rules,
    },
  })),
  eslintConfigPrettier,
];
