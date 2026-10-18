import { BullModule, InjectQueue } from "@nestjs/bullmq";
import {
  Controller,
  Body,
  Delete,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EVENTS } from "@krompay/shared";
import { Prisma } from "@prisma/client";
import { Queue } from "bullmq";
import { IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationDeliveryProcessor } from "./notification-delivery.processor";

type NoticeContent = {
  channel: "email" | "push";
  titleEn: string;
  titleKm: string;
  bodyEn: string;
  bodyKm: string;
  payload: Record<string, unknown>;
};

class RegisterPushTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token: string;

  @IsIn(["android", "ios", "web"])
  platform: "android" | "ios" | "web";
}

class DeletePushTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token: string;
}

@Injectable()
class NotificationDispatcher {
  private readonly log = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue("notifications") private readonly queue: Queue,
  ) {}

  @OnEvent(EVENTS.PAYROLL_APPROVED)
  async onPayrollApproved(payload: { tenantId: string; runId: string }) {
    await this.notifyPermission(payload.tenantId, "payroll.read", [{
      channel: "email",
      titleEn: "Payroll approved",
      titleKm: "ប្រាក់ខែត្រូវបានអនុម័ត",
      bodyEn: `Payroll run ${payload.runId} was approved. Payslips will be generated.`,
      bodyKm: `ការគណនាប្រាក់ខែ ${payload.runId} ត្រូវបានអនុម័ត។`,
      payload,
    }]);
  }

  @OnEvent(EVENTS.LEAVE_SUBMITTED)
  async onLeaveSubmitted(payload: { tenantId: string; id: string }) {
    await this.notifyPermission(payload.tenantId, "leave.approve", [
      {
        channel: "email",
        titleEn: "Leave request awaiting approval",
        titleKm: "សំណើច្បាប់រង់ចាំការអនុម័ត",
        bodyEn: `A new leave request (${payload.id}) is waiting for your decision.`,
        bodyKm: `សំណើច្បាប់ថ្មី (${payload.id}) កំពុងរង់ចាំការសម្រេចរបស់អ្នក។`,
        payload,
      },
      {
        channel: "push",
        titleEn: "Leave request awaiting approval",
        titleKm: "សំណើច្បាប់រង់ចាំការអនុម័ត",
        bodyEn: "A new leave request is waiting for your decision.",
        bodyKm: "មានសំណើច្បាប់ថ្មីកំពុងរង់ចាំការសម្រេច។",
        payload,
      },
    ]);
  }

  @OnEvent(EVENTS.LEAVE_DECIDED)
  async onLeaveDecided(payload: {
    tenantId: string;
    employeeId: string;
    id: string;
    status: string;
  }) {
    const recipient = await this.prisma.user.findFirst({
      where: { tenantId: payload.tenantId, employeeId: payload.employeeId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (!recipient) return;
    const approved = payload.status === "APPROVED";
    const content: NoticeContent[] = [
      {
        channel: "email",
        titleEn: approved ? "Leave request approved" : "Leave request declined",
        titleKm: approved ? "សំណើច្បាប់ត្រូវបានអនុម័ត" : "សំណើច្បាប់ត្រូវបានបដិសេធ",
        bodyEn: `Your leave request (${payload.id}) was ${approved ? "approved" : "declined"}.`,
        bodyKm: `សំណើច្បាប់របស់អ្នក (${payload.id}) ${approved ? "ត្រូវបានអនុម័ត" : "ត្រូវបានបដិសេធ"}។`,
        payload,
      },
      {
        channel: "push",
        titleEn: approved ? "Leave request approved" : "Leave request declined",
        titleKm: approved ? "សំណើច្បាប់ត្រូវបានអនុម័ត" : "សំណើច្បាប់ត្រូវបានបដិសេធ",
        bodyEn: `Your leave request was ${approved ? "approved" : "declined"}.`,
        bodyKm: `សំណើច្បាប់របស់អ្នក ${approved ? "ត្រូវបានអនុម័ត" : "ត្រូវបានបដិសេធ"}។`,
        payload,
      },
    ];
    await this.notifyUsers(payload.tenantId, [recipient], content);
  }

  @OnEvent(EVENTS.PAYSLIP_GENERATED)
  async onPayslipGenerated(payload: { tenantId: string; employeeId: string; fileId: string }) {
    const recipient = await this.prisma.user.findFirst({
      where: { tenantId: payload.tenantId, employeeId: payload.employeeId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (!recipient) return;
    await this.notifyUsers(payload.tenantId, [recipient], [
      {
        channel: "email",
        titleEn: "Your payslip is ready",
        titleKm: "សន្លឹកប្រាក់ខែរបស់អ្នករួចរាល់ហើយ",
        bodyEn: "Your new payslip is available in KromPay Employee Self-Service.",
        bodyKm: "សន្លឹកប្រាក់ខែថ្មីរបស់អ្នកអាចមើលបានក្នុង KromPay Employee Self-Service។",
        payload: { fileId: payload.fileId },
      },
      {
        channel: "push",
        titleEn: "Your payslip is ready",
        titleKm: "សន្លឹកប្រាក់ខែរបស់អ្នករួចរាល់ហើយ",
        bodyEn: "Your new payslip is ready to view.",
        bodyKm: "សន្លឹកប្រាក់ខែថ្មីរបស់អ្នករួចរាល់សម្រាប់មើល។",
        payload: { fileId: payload.fileId },
      },
    ]);
  }

  private async notifyPermission(tenantId: string, permissionCode: string, content: NoticeContent[]) {
    const recipients = await this.prisma.user.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        deletedAt: null,
        roles: {
          some: {
            role: {
              permissions: { some: { permission: { code: permissionCode } } },
            },
          },
        },
      },
      select: { id: true },
    });
    await this.notifyUsers(tenantId, recipients, content);
    this.log.log(`Queued ${content.length} notification channel(s) for ${recipients.length} ${permissionCode} recipient(s)`);
  }

  private async notifyUsers(tenantId: string, recipients: Array<{ id: string }>, content: NoticeContent[]) {
    await Promise.all(recipients.flatMap((recipient) => content.map(async (notice) => {
      const notification = await this.prisma.notification.create({
        data: {
          tenantId,
          userId: recipient.id,
          ...notice,
          payload: notice.payload as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      await this.queue.add(
        "deliver",
        { notificationId: notification.id },
        { jobId: `notification-${notification.id}` },
      );
    })));
  }
}

@Controller("notifications")
class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  mine(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.notification.findMany({
      where: { tenantId: user.tenantId, OR: [{ userId: user.userId }, { userId: null }] },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  @Post("push-token")
  async registerPushToken(@CurrentUser() user: AuthPrincipal, @Body() dto: RegisterPushTokenDto) {
    const existing = await this.prisma.pushToken.findUnique({ where: { token: dto.token } });
    if (existing && existing.userId !== user.userId) {
      await this.prisma.pushToken.update({
        where: { id: existing.id },
        data: { userId: user.userId, platform: dto.platform },
      });
      return { registered: true };
    }
    await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      create: { userId: user.userId, token: dto.token, platform: dto.platform },
      update: { platform: dto.platform },
    });
    return { registered: true };
  }

  @Delete("push-token")
  async deletePushToken(@CurrentUser() user: AuthPrincipal, @Body() dto: DeletePushTokenDto) {
    await this.prisma.pushToken.deleteMany({ where: { userId: user.userId, token: dto.token } });
    return { deleted: true };
  }

  @Patch(":id/read")
  async markRead(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, tenantId: user.tenantId, userId: user.userId },
      data: { readAt: new Date() },
    });
    if (!result.count) throw new NotFoundException("Notification not found");
    return this.prisma.notification.findFirstOrThrow({
      where: { id, tenantId: user.tenantId, userId: user.userId },
    });
  }
}

@Module({
  imports: [BullModule.registerQueue({
    name: "notifications",
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 10_000,
    },
  })],
  controllers: [NotificationsController],
  providers: [NotificationDispatcher, NotificationDeliveryProcessor],
})
export class NotificationsModule {}
