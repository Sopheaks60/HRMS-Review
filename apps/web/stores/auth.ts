import { defineStore } from "pinia";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    accessToken: "" as string,
    tenantSlug: "demo",
    locale: "km",
    userId: "",
    employeeId: "" as string | undefined,
    permissions: [] as string[],
  }),
  actions: {
    async login(email: string, password: string, tenantSlug: string) {
      const config = useRuntimeConfig();
      const res = await $fetch<{ accessToken: string }>(`${config.public.apiUrl}/auth/login`, {
        method: "POST",
        body: { email, password, tenantSlug },
      });
      const cookie = useCookie<string | null>("kp.access", {
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 15 * 60,
        path: "/",
      });
      const principal = await $fetch<{
        userId: string;
        employeeId?: string;
        permissions: string[];
      }>(`${config.public.apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${res.accessToken}`, "X-Tenant-Slug": tenantSlug },
      });
      this.accessToken = res.accessToken;
      this.tenantSlug = tenantSlug;
      this.userId = principal.userId;
      this.employeeId = principal.employeeId;
      this.permissions = principal.permissions;
      cookie.value = res.accessToken;
    },
    async hydrate() {
      const cookie = useCookie<string | null>("kp.access", { path: "/" });
      this.accessToken = cookie.value ?? "";
      if (!this.accessToken) return;
      try {
        const config = useRuntimeConfig();
        const apiBase = import.meta.server ? config.apiInternalUrl : config.public.apiUrl;
        const principal = await $fetch<{
          userId: string;
          employeeId?: string;
          permissions: string[];
        }>(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${this.accessToken}`, "X-Tenant-Slug": this.tenantSlug },
        });
        this.userId = principal.userId;
        this.employeeId = principal.employeeId;
        this.permissions = principal.permissions;
      } catch {
        this.logout();
      }
    },
    logout() {
      const cookie = useCookie<string | null>("kp.access", { path: "/" });
      cookie.value = null;
      this.accessToken = "";
      this.userId = "";
      this.employeeId = undefined;
      this.permissions = [];
    },
  },
});
