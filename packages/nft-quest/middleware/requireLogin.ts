export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn } = storeToRefs(useAccountStore());

  if (!isLoggedIn.value && to.path !== "/") {
    return navigateTo("/");
  }
});
