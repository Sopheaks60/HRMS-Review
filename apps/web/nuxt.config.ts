export default defineNuxtConfig({
  compatibilityDate: "2026-01-01",
  ssr: true,
  modules: ["@pinia/nuxt", "@nuxtjs/tailwindcss", "@nuxtjs/i18n"],
  runtimeConfig: {
    apiInternalUrl: process.env.API_INTERNAL_URL ?? "/api",
    public: {
      apiUrl: process.env.API_URL ?? "/api",
    },
  },
  i18n: {
    locales: [
      { code: "en", language: "en-US", file: "en.ts", name: "English" },
      { code: "km", language: "km-KH", file: "km.ts", name: "ខ្មែរ" },
    ],
    defaultLocale: "km",
    lazy: true,
    langDir: "locales",
    strategy: "prefix_except_default",
  },
  app: {
    head: {
      title: "KromPay",
      htmlAttrs: { lang: "km" },
      meta: [
        { name: "description", content: "Enterprise HRMS and Cambodia payroll" },
      ],
    },
  },
});
