import withNuxt from "./.nuxt/eslint.config.mjs";

// https://eslint.nuxt.com/packages/module#config-customizations
export default withNuxt().override("nuxt/vue/rules", {
  rules: {
    // ...Override rules, for example:
    "vue/require-default-prop": "off",
    "vue/multi-word-component-names": "off",
  },
});
