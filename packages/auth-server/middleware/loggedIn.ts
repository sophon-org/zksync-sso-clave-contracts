export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn } = useAccountStore();

  if (isLoggedIn) {
    switch (to.path) {
      case "/":
      case "/login":
      case "/register":
        return navigateTo("/dashboard");
    }
  }
});
