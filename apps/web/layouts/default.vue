<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <aside class="fixed inset-y-0 left-0 w-60 border-r bg-white p-4">
      <p class="text-xl font-semibold text-emerald-700">KromPay</p>
      <nav class="mt-6 flex flex-col gap-2 text-sm">
        <NuxtLink to="/">{{ $t("nav.dashboard") }}</NuxtLink>
        <NuxtLink to="/hr/employees">{{ $t("nav.employees") }}</NuxtLink>
        <NuxtLink to="/attendance">{{ $t("nav.attendance") }}</NuxtLink>
        <NuxtLink to="/leave">{{ $t("nav.leave") }}</NuxtLink>
        <NuxtLink to="/payroll">{{ $t("nav.payroll") }}</NuxtLink>
        <NuxtLink to="/payroll/seniority" class="pl-3 text-xs text-slate-600">↳ Seniority (P.442)</NuxtLink>
        <NuxtLink to="/recruitment">{{ $t("nav.recruitment") }}</NuxtLink>
        <NuxtLink to="/performance">{{ $t("nav.performance") }}</NuxtLink>
        <NuxtLink to="/lms">{{ $t("nav.lms") }}</NuxtLink>
        <NuxtLink to="/expenses">{{ $t("nav.expenses") }}</NuxtLink>
        <NuxtLink to="/assets">{{ $t("nav.assets") }}</NuxtLink>
        <NuxtLink to="/reports">Reports & Filing</NuxtLink>
        <NuxtLink to="/compliance">Labor Compliance (MoLVT)</NuxtLink>
        <NuxtLink to="/database">Database Telemetry (Neon)</NuxtLink>
        <NuxtLink to="/ess">{{ $t("nav.ess") }}</NuxtLink>
        <NuxtLink to="/billing">{{ $t("nav.billing") }}</NuxtLink>
        <NuxtLink to="/settings">System Parameters</NuxtLink>
      </nav>
    </aside>
    <main class="ml-60 p-8">
      <slot />
    </main>
  </div>
</template>
