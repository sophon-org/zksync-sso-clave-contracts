import { createConfigForNuxt } from "@nuxt/eslint-config/flat";

export default createConfigForNuxt({
  rules: {
    "no-console": "warn",
    "vue/multi-word-component-names": "off", // Allow multi-word component names
    "vue/require-default-prop": "off", // Allow props without default values
  },
});
