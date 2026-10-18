export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore();
  await auth.hydrate();
  if (!auth.accessToken) return navigateTo("/login");
});
