ALTER TABLE "Subscription"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

CREATE UNIQUE INDEX "Subscription_providerSubId_key"
ON "Subscription"("providerSubId");

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);
