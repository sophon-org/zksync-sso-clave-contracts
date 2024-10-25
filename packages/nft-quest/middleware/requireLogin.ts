export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn } = storeToRefs(useAccountStore());
  if (import.meta.server) return;

  if (!isLoggedIn.value && to.path !== "/") {
    return navigateTo("/");
  }
});
