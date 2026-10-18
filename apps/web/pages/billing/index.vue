<script setup lang="ts">
definePageMeta({ middleware: "auth" });

type Subscription = {
  plan: string;
  seats: number;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
};
type Invoice = {
  id: string;
  number: string;
  amountMinor: number | string;
  currency: string;
  status: string;
  issuedAt: string;
  paidAt: string | null;
};

const api = useApi();
const auth = useAuthStore();
const canManage = computed(() => auth.permissions.includes("billing.manage"));
const subscription = ref<Subscription | null>(null);
const invoices = ref<Invoice[]>([]);
const loading = ref(true);
const busy = ref("");
const error = ref("");
const notice = ref("");
const route = useRoute();

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [current, history] = await Promise.all([
      api<Subscription | null>("/billing/subscription"),
      api<Invoice[]>("/billing/invoices"),
    ]);
    subscription.value = current;
    invoices.value = history;
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load billing details.";
  } finally {
    loading.value = false;
  }
}

async function openBillingFlow(kind: "checkout" | "portal", plan?: string) {
  busy.value = kind === "checkout" ? plan ?? "" : "portal";
  error.value = "";
  try {
    const result = await api<{ url: string }>(`/billing/${kind}`, {
      method: "POST",
      ...(plan ? { body: { plan } } : {}),
    });
    window.location.assign(result.url);
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not open the Stripe billing page.";
  } finally {
    busy.value = "";
  }
}

const planNames: Record<string, string> = {
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
};
const checkoutState = route.query.checkout;
if (checkoutState === "success") notice.value = "Checkout completed. Your subscription will appear after Stripe confirms it.";
if (checkoutState === "cancelled") notice.value = "Checkout was cancelled; no plan change was made.";

onMounted(load);
</script>

<template>
  <section class="mx-auto max-w-5xl space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ $t("nav.billing") }}</h1>
        <p class="mt-1 text-sm text-slate-600">Manage your KromPay plan and review billing history.</p>
      </div>
      <button class="rounded border px-3 py-2 text-sm" :disabled="loading" @click="load">Refresh</button>
    </header>

    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>
    <p v-if="notice" role="status" class="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{{ notice }}</p>
    <div v-if="loading" class="rounded-lg border bg-white p-6 text-slate-600">Loading billing…</div>
    <template v-else>
      <article class="rounded-lg border bg-white p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm text-slate-500">Current plan</p>
            <h2 class="mt-1 text-xl font-semibold">{{ planNames[subscription?.plan ?? ""] ?? subscription?.plan ?? "No active subscription" }}</h2>
            <p v-if="subscription" class="mt-1 text-sm text-slate-600">{{ subscription.seats }} seats · {{ subscription.billingCycle }} billing</p>
            <p v-if="subscription" class="mt-1 text-sm text-slate-600">Current period ends {{ new Date(subscription.currentPeriodEnd).toLocaleDateString() }}<span v-if="subscription.cancelAtPeriodEnd"> · Cancellation scheduled</span></p>
            <p v-else class="mt-1 text-sm text-slate-600">Choose a plan to begin a subscription.</p>
          </div>
          <button v-if="canManage && subscription" class="rounded border px-4 py-2 text-sm" :disabled="!!busy" @click="openBillingFlow('portal')">{{ busy === "portal" ? "Opening…" : "Manage subscription" }}</button>
        </div>
      </article>

      <section v-if="canManage && !subscription" class="space-y-3">
        <h2 class="text-lg font-semibold">Choose a plan</h2>
        <div class="grid gap-3 md:grid-cols-3">
          <article v-for="plan in ['STARTER', 'PROFESSIONAL', 'ENTERPRISE']" :key="plan" class="flex flex-col rounded-lg border bg-white p-4">
            <h3 class="font-semibold">{{ planNames[plan] }}</h3>
            <p class="mt-2 flex-1 text-sm text-slate-600">{{ plan === 'STARTER' ? 'Core HR and employee self-service.' : plan === 'PROFESSIONAL' ? 'Advanced workflows for growing teams.' : 'Flexible controls and support for larger organizations.' }}</p>
            <button class="mt-4 rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" :disabled="!!busy" @click="openBillingFlow('checkout', plan)">{{ busy === plan ? "Opening Stripe…" : `Continue with ${planNames[plan]}` }}</button>
          </article>
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-semibold">Invoices</h2>
        <div v-if="!invoices.length" class="rounded-lg border bg-white p-5 text-sm text-slate-600">No invoices are available yet.</div>
        <div v-else class="overflow-x-auto rounded-lg border bg-white">
          <table class="w-full text-left text-sm">
            <thead class="border-b bg-slate-50 text-slate-600"><tr><th class="p-3">Invoice</th><th class="p-3">Issued</th><th class="p-3">Amount</th><th class="p-3">Status</th><th class="p-3">Paid</th></tr></thead>
            <tbody><tr v-for="invoice in invoices" :key="invoice.id" class="border-b last:border-0"><td class="p-3 font-medium">{{ invoice.number }}</td><td class="p-3">{{ new Date(invoice.issuedAt).toLocaleDateString() }}</td><td class="p-3">{{ (Number(invoice.amountMinor) / 100).toLocaleString(undefined, { style: 'currency', currency: invoice.currency }) }}</td><td class="p-3">{{ invoice.status }}</td><td class="p-3">{{ invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : "—" }}</td></tr></tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
