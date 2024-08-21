import type { NavigationGuard } from 'vue-router'
export type MiddlewareKey = string
declare module "../../../../node_modules/.pnpm/nuxt@3.13.0_@parcel+watcher@2.4.1_@types+node@18.16.9_eslint@9.9.0_jiti@1.21.6__ioredis@5.4.1_m7faqoqwd236wevess32z4lbly/node_modules/nuxt/dist/pages/runtime/composables" {
  interface PageMeta {
    middleware?: MiddlewareKey | NavigationGuard | Array<MiddlewareKey | NavigationGuard>
  }
}
declare module 'nitropack' {
  interface NitroRouteConfig {
    appMiddleware?: MiddlewareKey | MiddlewareKey[] | Record<MiddlewareKey, boolean>
  }
}