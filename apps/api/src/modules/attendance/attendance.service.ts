import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { EVENTS } from "@krompay/shared";
import { PrismaService } from "../../prisma/prisma.service";

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function localWorkDate(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (key: string) => Number(parts.find((part) => part.type === key)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async nextClockType(tenantId: string, employeeId: string, at: Date) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    const workDate = localWorkDate(at, tenant.timezone);
    const lastPunch = await this.prisma.attendance.findFirst({
      where: { tenantId, employeeId, workDate },
      orderBy: { punchedAt: "desc" },
      select: { type: true },
    });
    return lastPunch?.type === "CLOCK_IN" ? "CLOCK_OUT" as const : "CLOCK_IN" as const;
  }

  async punch(params: {
    tenantId: string;
    employeeId: string;
    type: "CLOCK_IN" | "CLOCK_OUT";
    source: "GPS" | "FACE" | "WEB" | "BIOMETRIC" | "MANUAL";
    latitude?: number;
    longitude?: number;
    accuracyM?: number;
    selfieId?: string;
    livenessScore?: number;
    deviceId?: string;
    punchedAt?: Date;
  }) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: params.employeeId, tenantId: params.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException("Employee not found in tenant");
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { timezone: true },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    let geofenceId: string | undefined;
    let insideFence: boolean | undefined;
    if (params.source === "GPS") {
      if (params.latitude == null || params.longitude == null) {
        throw new BadRequestException("GPS coordinates required");
      }
      const fences = await this.prisma.geofence.findMany({
        where: { tenantId: params.tenantId, active: true },
      });
      const hit = fences.find(
        (f) =>
          haversineM(
            params.latitude!,
            params.longitude!,
            Number(f.latitude),
            Number(f.longitude),
          ) <= f.radiusM,
      );
      if (!hit) throw new BadRequestException("Outside allowed geofence");
      geofenceId = hit.id;
      insideFence = true;
    }
    if (params.source === "FACE") {
      if (!params.selfieId) throw new BadRequestException("Selfie required");
      const proof = await this.prisma.faceSelfie.findFirst({
        where: {
          id: params.selfieId,
          employeeId: params.employeeId,
          employee: { tenantId: params.tenantId },
        },
        select: { matchScore: true, livenessScore: true, createdAt: true, usedAt: true },
      });
      if (!proof || proof.usedAt || Date.now() - proof.createdAt.getTime() > 2 * 60_000 || Number(proof.matchScore ?? 0) < 0.85 || Number(proof.livenessScore ?? 0) < 0.85) {
        throw new BadRequestException("Selfie has not passed server-side verification");
      }
      params.livenessScore = Number(proof.matchScore);
    }

    const punchedAt = params.punchedAt ?? new Date();
    if (!Number.isFinite(punchedAt.getTime())) throw new BadRequestException("Invalid punch timestamp");
    const workDate = localWorkDate(punchedAt, tenant.timezone);
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${params.tenantId}), hashtext(${params.employeeId}))`;
      const lastPunch = await tx.attendance.findFirst({
        where: { tenantId: params.tenantId, employeeId: params.employeeId, workDate },
        orderBy: { punchedAt: "desc" },
        select: { type: true },
      });
      if (params.type === "CLOCK_IN" && lastPunch?.type === "CLOCK_IN") {
        throw new BadRequestException("You are already clocked in");
      }
      if (params.type === "CLOCK_OUT" && lastPunch?.type !== "CLOCK_IN") {
        throw new BadRequestException("You must clock in before clocking out");
      }
      if (params.source === "FACE") {
        const consumed = await tx.faceSelfie.updateMany({
          where: { id: params.selfieId, employeeId: params.employeeId, usedAt: null, createdAt: { gte: new Date(Date.now() - 2 * 60_000) } },
          data: { usedAt: new Date() },
        });
        if (!consumed.count) throw new BadRequestException("Selfie proof expired or has already been used");
      }
      return tx.attendance.create({
        data: {
          tenantId: params.tenantId,
          employeeId: params.employeeId,
          type: params.type,
          source: params.source,
          punchedAt,
          workDate,
          latitude: params.latitude,
          longitude: params.longitude,
          accuracyM: params.accuracyM,
          geofenceId,
          insideFence,
          selfieId: params.selfieId,
          livenessScore: params.livenessScore,
          deviceId: params.deviceId,
        },
      });
    });
    this.events.emit(EVENTS.ATTENDANCE_PUNCHED, record);
    return record;
  }
}
