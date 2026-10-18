import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ createTransport: () => ({ sendMail }) }));

import { NotificationDeliveryProcessor } from "../src/modules/notifications/notification-delivery.processor";

const config = {
  get: (key: string) => ({
    SMTP_HOST: "mail.test",
    SMTP_PORT: "1025",
    SMTP_FROM: "KromPay <noreply@test.local>",
    SMTP_TLS_REJECT_UNAUTHORIZED: "true",
  })[key],
};

function makeProcessor(notification: Record<string, unknown>) {
  const prisma = {
    notification: {
      findFirst: vi.fn().mockResolvedValue(notification),
      update: vi.fn().mockResolvedValue({}),
    },
    pushToken: { deleteMany: vi.fn() },
  };
  const processor = new NotificationDeliveryProcessor(prisma as never, config as never);
  return { processor, prisma };
}

describe("NotificationDeliveryProcessor", () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ messageId: "mail-id" });
  });

  it("sends localized email and marks the notification delivered", async () => {
    const { processor, prisma } = makeProcessor({
      id: "notification-1",
      channel: "email",
      titleEn: "Payroll approved",
      titleKm: "ប្រាក់ខែបានអនុម័ត",
      bodyEn: "Pay run & approved",
      bodyKm: "ប្រាក់ខែរួចរាល់",
      payload: {},
      sentAt: null,
      user: { id: "user-1", email: "person@example.test", locale: "en", pushTokens: [] },
    });

    await processor.process({ data: { notificationId: "notification-1" } } as never);

    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "person@example.test",
      subject: "Payroll approved",
      text: "Pay run & approved",
      html: expect.stringContaining("Pay run &amp; approved"),
    }));
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "notification-1" },
      data: { sentAt: expect.any(Date) },
    });
  });

  it("does not send again when a job is retried after successful delivery", async () => {
    const { processor, prisma } = makeProcessor({
      id: "notification-2",
      channel: "email",
      sentAt: new Date(),
      user: { id: "user-1", email: "person@example.test", locale: "km", pushTokens: [] },
    });

    await processor.process({ data: { notificationId: "notification-2" } } as never);

    expect(sendMail).not.toHaveBeenCalled();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("leaves delivery pending when SMTP fails so BullMQ can retry", async () => {
    sendMail.mockRejectedValueOnce(new Error("SMTP unavailable"));
    const { processor, prisma } = makeProcessor({
      id: "notification-3",
      channel: "email",
      titleEn: "Hello",
      titleKm: "ជំរាបសួរ",
      bodyEn: "Body",
      bodyKm: "អត្ថបទ",
      payload: {},
      sentAt: null,
      user: { id: "user-1", email: "person@example.test", locale: "en", pushTokens: [] },
    });

    await expect(processor.process({ data: { notificationId: "notification-3" } } as never)).rejects.toThrow("SMTP unavailable");
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });
});
