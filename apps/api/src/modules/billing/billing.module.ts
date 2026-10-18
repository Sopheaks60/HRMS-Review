import { BadGatewayException, BadRequestException, ConflictException, Controller, Get, Post, Body, Req, ServiceUnavailableException, UnauthorizedException, UseGuards, Module } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { IsIn } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { Public } from "../../common/decorators/public.decorator";

class CheckoutDto {
  @IsIn(["STARTER", "PROFESSIONAL", "ENTERPRISE"])
  plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
}

@Controller("billing")
@UseGuards(PermissionsGuard)
export class BillingController {
  constructor(private readonly prisma: PrismaService) {}

  private async stripe(path: string, fields: Record<string, string>) {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new ServiceUnavailableException("Billing is not configured");
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => null) as { id?: string; url?: string; error?: { message?: string } } | null;
    if (!response.ok || !payload?.url) throw new BadGatewayException("Payment provider could not create a billing session");
    return payload;
  }

  @Post("webhook")
  @Public()
  async webhook(@Req() request: Request & { rawBody?: Buffer }) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = request.headers["stripe-signature"];
    if (!secret || typeof signature !== "string" || !request.rawBody) {
      throw new BadRequestException("Invalid Stripe webhook request");
    }
    const parts = signature.split(",").map((part) => part.split("=", 2));
    const timestamp = parts.find(([key]) => key === "t")?.[1];
    const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value).filter((value): value is string => Boolean(value));
    const timestampSeconds = Number(timestamp);
    if (!timestamp || !Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
      throw new BadRequestException("Expired or invalid Stripe webhook signature");
    }
    const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(request.rawBody).digest();
    const valid = signatures.some((candidate) => {
      if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
      const actual = Buffer.from(candidate, "hex");
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    });
    if (!valid) throw new BadRequestException("Invalid Stripe webhook signature");

    let event: {
      id: string;
      type: string;
      data: { object: Record<string, any> };
    };
    try {
      event = JSON.parse(request.rawBody.toString("utf8"));
      if (!event.id || !event.type || !event.data?.object) throw new Error("Missing event fields");
    } catch {
      throw new BadRequestException("Malformed Stripe event payload");
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
        const object = event.data.object;
        if (event.type.startsWith("customer.subscription.")) {
          const tenantId = object.metadata?.tenantId;
          const plan = object.metadata?.plan;
          const subscriptionId = object.id;
          if (!tenantId || !subscriptionId || !["STARTER", "PROFESSIONAL", "ENTERPRISE"].includes(plan)) return;
          const tenant = await tx.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { id: true } });
          if (!tenant) return;
          const status = String(object.status ?? "incomplete");
          const periodStart = new Date(Number(object.current_period_start) * 1000);
          const periodEnd = new Date(Number(object.current_period_end) * 1000);
          if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime())) return;
          const itemQuantity = Number(object.items?.data?.[0]?.quantity ?? 1);
          const data = {
            tenantId,
            plan,
            seats: Number.isSafeInteger(itemQuantity) && itemQuantity > 0 ? itemQuantity : 1,
            billingCycle: object.items?.data?.[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly",
            provider: "stripe",
            providerCustomerId: String(object.customer),
            providerSubId: subscriptionId,
            status,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
          };
          await tx.subscription.upsert({
            where: { providerSubId: subscriptionId },
            create: data,
            update: data,
          });
          const tenantStatus = status === "active" ? "ACTIVE" : status === "trialing" ? "TRIAL" : status === "past_due" || status === "unpaid" ? "PAST_DUE" : status === "canceled" ? "CANCELLED" : null;
          if (tenantStatus) await tx.tenant.update({ where: { id: tenantId }, data: { status: tenantStatus } });
        } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
          const subscriptionId = typeof object.subscription === "string" ? object.subscription : object.subscription?.id;
          if (!subscriptionId) return;
          const subscription = await tx.subscription.findUnique({ where: { providerSubId: subscriptionId }, select: { tenantId: true } });
          if (!subscription) return;
          const invoiceId = String(object.id);
          const invoiceNumber = String(object.number ?? invoiceId);
          await tx.invoice.upsert({
            where: { tenantId_number: { tenantId: subscription.tenantId, number: invoiceNumber } },
            create: {
              tenantId: subscription.tenantId,
              number: invoiceNumber,
              amountMinor: BigInt(object.amount_paid ?? object.amount_due ?? 0),
              currency: String(object.currency ?? "usd").toUpperCase(),
              status: event.type === "invoice.paid" ? "paid" : "payment_failed",
              issuedAt: new Date(Number(object.created ?? Date.now() / 1000) * 1000),
              paidAt: event.type === "invoice.paid" ? new Date() : null,
              providerRef: invoiceId,
            },
            update: {
              amountMinor: BigInt(object.amount_paid ?? object.amount_due ?? 0),
              status: event.type === "invoice.paid" ? "paid" : "payment_failed",
              paidAt: event.type === "invoice.paid" ? new Date() : null,
              providerRef: invoiceId,
            },
          });
        }
      });
    } catch (cause) {
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "P2002") {
        const previous = await this.prisma.stripeWebhookEvent.findUnique({ where: { id: event.id }, select: { id: true } });
        if (previous) return { received: true, duplicate: true };
      }
      throw cause;
    }
    return { received: true };
  }

  @Post("checkout")
  @RequirePermissions("billing.manage")
  async checkout(@CurrentUser() user: AuthPrincipal, @Body() dto: CheckoutDto) {
    const priceId = process.env[`STRIPE_PRICE_${dto.plan}`];
    if (!priceId) throw new ServiceUnavailableException(`Stripe price is not configured for ${dto.plan}`);
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: user.tenantId, deletedAt: null },
      select: { name: true, slug: true },
    });
    if (!tenant) throw new UnauthorizedException("Tenant is unavailable");
    const current = await this.prisma.subscription.findFirst({
      where: { tenantId: user.tenantId }, orderBy: { createdAt: "desc" },
    });
    if (current && ["active", "trialing", "past_due"].includes(current.status)) {
      throw new ConflictException("Manage an existing subscription through the billing portal");
    }
    const appUrl = ((process.env.APP_URL ?? "http://localhost:3000").split(",")[0] ?? "http://localhost:3000").replace(/\/$/, "");
    const fields: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${appUrl}/billing?checkout=success`,
      cancel_url: `${appUrl}/billing?checkout=cancelled`,
      client_reference_id: user.tenantId,
      "metadata[tenantId]": user.tenantId,
      "metadata[plan]": dto.plan,
      "subscription_data[metadata][tenantId]": user.tenantId,
      "subscription_data[metadata][plan]": dto.plan,
    };
    if (current?.providerCustomerId) fields.customer = current.providerCustomerId;
    const session = await this.stripe("checkout/sessions", fields);
    return { url: session.url };
  }

  @Post("portal")
  @RequirePermissions("billing.manage")
  async portal(@CurrentUser() user: AuthPrincipal) {
    const current = await this.prisma.subscription.findFirst({
      where: { tenantId: user.tenantId, provider: "stripe", providerCustomerId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { providerCustomerId: true },
    });
    if (!current?.providerCustomerId) throw new UnauthorizedException("No Stripe customer is linked to this tenant yet");
    const appUrl = ((process.env.APP_URL ?? "http://localhost:3000").split(",")[0] ?? "http://localhost:3000").replace(/\/$/, "");
    const session = await this.stripe("billing_portal/sessions", {
      customer: current.providerCustomerId,
      return_url: `${appUrl}/billing`,
    });
    return { url: session.url };
  }

  @Get("subscription")
  @RequirePermissions("billing.manage")
  current(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.subscription.findFirst({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  @Get("invoices")
  @RequirePermissions("billing.manage")
  invoices(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.invoice.findMany({ where: { tenantId: user.tenantId }, orderBy: { issuedAt: "desc" }, take: 100 });
  }
}

@Module({ controllers: [BillingController] })
export class BillingModule {}
