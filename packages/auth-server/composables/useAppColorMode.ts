import { useColorMode } from "@vueuse/core";

export const useAppColorMode = () => {
  const mode = useColorMode({
    modes: {
      light: "light-mode",
      dark: "dark-mode",
    },
  });

  const isDark = ref(mode.value === "dark");

  watchEffect(() => {
    mode.value = isDark.value ? "dark" : "light";
  });

  return {
    isDark,
  };
};
