import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AttendanceService } from "../attendance/attendance.service";

/** ZKTeco ADMS/PUSH attendance ingest. Devices POST punches to /iclock/cdata. */
@Injectable()
export class BiometricService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly config: ConfigService,
  ) {}

  verifyWebhook(rawBody: string, signature: string, timestamp: string) {
    const secret = this.config.getOrThrow<string>("BIOMETRIC_WEBHOOK_SECRET");
    const timestampMs = Date.parse(timestamp);
    if (!timestamp || !Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) {
      throw new UnauthorizedException("Missing or expired device gateway timestamp");
    }
    const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException("Invalid device signature");
    }
  }

  async findEnabledDevice(serial: string) {
    if (!serial || serial.length > 80) return null;
    const devices = await this.prisma.biometricDevice.findMany({ where: { serialNo: serial, pushEnabled: true }, take: 2 });
    if (devices.length > 1) throw new ConflictException("Device serial is registered in multiple tenants");
    return devices[0] ?? null;
  }

  async acknowledgeDevice(serial: string) {
    const device = await this.findEnabledDevice(serial);
    if (!device) throw new NotFoundException("Device is not registered");
    await this.prisma.biometricDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  }

  async ingestAttlog(serial: string, body: string) {
    if (Buffer.byteLength(body, "utf8") > 5 * 1024 * 1024) throw new BadRequestException("ADMS upload exceeds 5 MB");
    const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length > 5000) throw new BadRequestException("ADMS upload contains too many records");
    const device = await this.findEnabledDevice(serial);
    if (!device) throw new NotFoundException("Device is not registered");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: device.tenantId }, select: { timezone: true } });
    if (!tenant) throw new NotFoundException("Device tenant not found");
    const results = [];
    for (const line of lines) {
      const columns = line.split("\t");
      if (columns.length < 2 || !columns[0] || !columns[1]) throw new BadRequestException("Malformed ADMS attendance record");
      const pin = columns[0].trim();
      if (pin.length > 40) throw new BadRequestException("ADMS PIN is too long");
      const punchedAt = this.parseDeviceDate(columns[1].trim(), tenant.timezone);
      const verifyMode = columns[3] && /^\d+$/.test(columns[3]) ? Number(columns[3]) : undefined;
      results.push(await this.ingestPush(serial, pin, punchedAt, verifyMode));
    }
    if (lines.length === 0) await this.acknowledgeDevice(serial);
    return { accepted: results.length };
  }

  private parseDeviceDate(value: string, timeZone: string) {
    const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})$/.exec(value);
    if (!match) throw new BadRequestException("Invalid ADMS attendance timestamp");
    const [, year, month, day, hour, minute, second] = match;
    const utcGuess = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(utcGuess));
    const get = (key: string) => Number(parts.find((part) => part.type === key)?.value);
    const representedAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    const result = new Date(utcGuess - (representedAsUtc - utcGuess));
    if (!Number.isFinite(result.getTime())) throw new BadRequestException("Invalid ADMS attendance timestamp");
    return result;
  }

  async ingestPush(serial: string, pin: string, punchedAt: Date, verifyMode?: number) {
    pin = pin.trim();
    if (!pin || pin.length > 40) throw new BadRequestException("Biometric PIN is invalid");
    if (!Number.isFinite(punchedAt.getTime())) throw new BadRequestException("Biometric punch timestamp is invalid");
    const device = await this.findEnabledDevice(serial);
    if (!device) return { ignored: true };
    return this.prisma.runAsTenant(device.tenantId, () => this.ingestPushForDevice(device, pin, punchedAt, verifyMode));
  }

  private async ingestPushForDevice(
    device: NonNullable<Awaited<ReturnType<BiometricService["findEnabledDevice"]>>>,
    pin: string,
    punchedAt: Date,
    verifyMode?: number,
  ) {
    await this.prisma.biometricDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
    const punch = await this.prisma.biometricPunch.upsert({
      where: {
        deviceId_pin_punchedAt: { deviceId: device.id, pin, punchedAt },
      },
      update: {},
      create: { deviceId: device.id, pin, punchedAt, verifyMode },
    });
    if (punch.attendanceId) return punch;
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId: device.tenantId, biometricPin: pin, deletedAt: null },
    });
    if (!employee) return punch;
    const att = await this.attendance.punch({
      tenantId: device.tenantId,
      employeeId: employee.id,
      type: await this.attendance.nextClockType(device.tenantId, employee.id, punchedAt),
      source: "BIOMETRIC",
      deviceId: device.id,
      punchedAt,
    });
    await this.prisma.biometricPunch.update({
      where: { id: punch.id },
      data: { attendanceId: att.id },
    });
    return punch;
  }
}
