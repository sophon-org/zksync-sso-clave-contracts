import { useStorage } from "@vueuse/core";
import type { AppMetadata } from "zksync-sso";

export const useAppMeta = () => {
  const route = useRoute();
  const { origin: popupOrigin } = useCommunicatorStore();

  const appMetaStorage = useStorage<{ [origin: string]: AppMetadata }>("app-meta", {});
  const appMeta = computed({
    get: () => appMetaStorage.value[origin.value],
    set: (value) => {
      appMetaStorage.value[origin.value] = value;
    },
  });
  const domain = computed(() => new URL(origin.value).host);
  const origin = computed(() => popupOrigin ?? route.query.origin as string);

  return {
    appMeta,
    domain,
    origin,
  };
};
