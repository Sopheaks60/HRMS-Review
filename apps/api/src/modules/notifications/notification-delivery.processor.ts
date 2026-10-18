import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";
import { createSign } from "node:crypto";
import * as nodemailer from "nodemailer";
import { PrismaService } from "../../prisma/prisma.service";

type DeliveryJob = { notificationId: string };

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

@Injectable()
@Processor("notifications")
export class NotificationDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);
  private readonly mailer: nodemailer.Transporter;
  private fcmAccessToken?: { value: string; expiresAt: number };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
    const port = Number(this.config.get<string>("SMTP_PORT") ?? 1025);
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASSWORD");
    this.mailer = nodemailer.createTransport({
      host: this.config.get<string>("SMTP_HOST") ?? "localhost",
      port,
      secure: this.config.get<string>("SMTP_SECURE") === "true",
      ...(user && pass ? { auth: { user, pass } } : {}),
      tls: {
        rejectUnauthorized: this.config.get<string>("SMTP_TLS_REJECT_UNAUTHORIZED") !== "false",
      },
    });
  }

  async process(job: Job<DeliveryJob>) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: job.data.notificationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            locale: true,
            pushTokens: { select: { id: true, token: true } },
          },
        },
      },
    });
    if (!notification) throw new Error("Notification record not found");
    if (notification.sentAt) return;
    if (!notification.user) throw new Error("Notification recipient is missing");

    const isKhmer = notification.user.locale === "km";
    const subject = isKhmer ? notification.titleKm : notification.titleEn;
    const body = isKhmer ? notification.bodyKm : notification.bodyEn;

    if (notification.channel === "email") {
      await this.mailer.sendMail({
        from: this.config.get<string>("SMTP_FROM") ?? "KromPay <noreply@localhost>",
        to: notification.user.email,
        subject,
        text: body,
        html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(body)}</div>`,
        messageId: `<krompay-notification-${notification.id}@${this.config.get<string>("EMAIL_MESSAGE_DOMAIN") ?? "localhost"}>`,
      });
    } else if (notification.channel === "push") {
      if (notification.user.pushTokens.length) {
        const accessToken = await this.getFcmAccessToken();
        const payload = notification.payload as Record<string, unknown>;
        const data = Object.fromEntries(
          Object.entries(payload).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
        );
        await Promise.all(
          notification.user.pushTokens.map(async ({ id, token }) => {
            const response = await fetch(
              `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.requiredConfig("FCM_PROJECT_ID"))}/messages:send`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  message: { token, notification: { title: subject, body }, data },
                }),
              },
            );
            if (response.ok) return;
            const details = await response.text();
            if (response.status === 404 || details.includes("UNREGISTERED")) {
              await this.prisma.pushToken.deleteMany({ where: { id } });
              return;
            }
            throw new Error(`FCM delivery failed (${response.status}): ${details.slice(0, 300)}`);
          }),
        );
      }
    } else {
      throw new Error(`Unsupported notification channel: ${notification.channel}`);
    }

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { sentAt: new Date() },
    });
    this.logger.log(`Delivered ${notification.channel} notification ${notification.id}`);
  }

  private requiredConfig(key: string) {
    const value = this.config.get<string>(key);
    if (!value) throw new Error(`${key} is required for push notification delivery`);
    return value;
  }

  private async getFcmAccessToken() {
    if (this.fcmAccessToken && this.fcmAccessToken.expiresAt > Date.now() + 60_000) {
      return this.fcmAccessToken.value;
    }
    const email = this.requiredConfig("FCM_CLIENT_EMAIL");
    const privateKey = this.requiredConfig("FCM_PRIVATE_KEY").replace(/\\n/g, "\n");
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claim = base64Url(JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }));
    const unsigned = `${header}.${claim}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const assertion = `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) throw new Error(`FCM OAuth token request failed (${response.status})`);
    const token = await response.json() as { access_token: string; expires_in: number };
    this.fcmAccessToken = {
      value: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    };
    return token.access_token;
  }
}
