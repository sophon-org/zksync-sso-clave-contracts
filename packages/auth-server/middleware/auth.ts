export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn } = useAccountStore();

  if (!isLoggedIn && to.path !== "/login") {
    return navigateTo("/login");
  }
});
