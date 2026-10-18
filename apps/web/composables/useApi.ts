export function useApi() {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  return $fetch.create({
    baseURL: import.meta.server ? config.apiInternalUrl : config.public.apiUrl,
    onRequest({ options }) {
      const headers = new Headers(options.headers);
      if (auth.accessToken) headers.set("Authorization", `Bearer ${auth.accessToken}`);
      headers.set("X-Tenant-Slug", auth.tenantSlug);
      options.headers = headers;
    },
  });
}
