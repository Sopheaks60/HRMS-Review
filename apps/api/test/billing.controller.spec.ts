import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { BillingController } from "../src/modules/billing/billing.module";

const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
});

function signedRequest(event: unknown) {
  const rawBody = Buffer.from(JSON.stringify(event));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const digest = createHmac("sha256", "test-secret").update(`${timestamp}.`).update(rawBody).digest("hex");
  return { rawBody, headers: { "stripe-signature": `t=${timestamp},v1=${digest}` } } as never;
}

describe("Stripe billing webhook", () => {
  it("verifies the signature and upserts a tenant-scoped subscription", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "test-secret";
    const tx = {
      stripeWebhookEvent: { create: vi.fn().mockResolvedValue({}) },
      tenant: {
        findFirst: vi.fn().mockResolvedValue({ id: "tenant-1" }),
        update: vi.fn().mockResolvedValue({}),
      },
      subscription: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { stripeWebhookEvent: { findUnique: vi.fn().mockResolvedValue(null) }, $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)) };
    const controller = new BillingController(prisma as never);
    const now = Math.floor(Date.now() / 1000);
    const request = signedRequest({
      id: "evt-1",
      type: "customer.subscription.created",
      data: { object: {
        id: "sub-1", customer: "cus-1", status: "active",
        current_period_start: now, current_period_end: now + 31_536_000,
        cancel_at_period_end: false,
        metadata: { tenantId: "tenant-1", plan: "PROFESSIONAL" },
        items: { data: [{ quantity: 40, price: { recurring: { interval: "year" } } }] },
      } },
    });

    await expect(controller.webhook(request)).resolves.toEqual({ received: true });
    expect(tx.stripeWebhookEvent.create).toHaveBeenCalledWith({ data: { id: "evt-1", type: "customer.subscription.created" } });
    expect(tx.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { providerSubId: "sub-1" },
      create: expect.objectContaining({ tenantId: "tenant-1", plan: "PROFESSIONAL", seats: 40, billingCycle: "yearly", status: "active" }),
    }));
    expect(tx.tenant.update).toHaveBeenCalledWith({ where: { id: "tenant-1" }, data: { status: "ACTIVE" } });
  });

  it("rejects a signature that does not match the raw request body", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "test-secret";
    const controller = new BillingController({} as never);
    const request = signedRequest({ id: "evt-2", type: "unknown", data: { object: {} } }) as { rawBody: Buffer; headers: Record<string, string> };
    request.headers["stripe-signature"] = `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`;
    await expect(controller.webhook(request as never)).rejects.toThrow("Invalid Stripe webhook signature");
  });

  it("acknowledges duplicate event IDs without applying them again", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "test-secret";
    const tx = { stripeWebhookEvent: { create: vi.fn().mockRejectedValue({ code: "P2002" }) } };
    const prisma = { stripeWebhookEvent: { findUnique: vi.fn().mockResolvedValue({ id: "evt-3" }) }, $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)) };
    const controller = new BillingController(prisma as never);
    const request = signedRequest({ id: "evt-3", type: "unhandled.event", data: { object: {} } });
    await expect(controller.webhook(request)).resolves.toEqual({ received: true, duplicate: true });
  });
});
