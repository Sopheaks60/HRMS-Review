import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AttendanceService } from "./attendance.service";
import { PrismaService } from "../../prisma/prisma.service";
import { FaceVerificationService } from "./face-verification.service";

class PunchDto {
  @IsEnum(["CLOCK_IN", "CLOCK_OUT"])
  type: "CLOCK_IN" | "CLOCK_OUT";

  @IsEnum(["GPS", "FACE", "WEB"])
  source: "GPS" | "FACE" | "WEB";

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  accuracyM?: number;

  @IsOptional()
  @IsUUID()
  selfieId?: string;

}

class AttendanceRangeDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

class FaceVerificationDto {
  @IsString()
  @MaxLength(7_000_000)
  imageDataUrl: string;
}

@ApiTags("attendance")
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller("attendance")
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly prisma: PrismaService,
    private readonly faceVerification: FaceVerificationService,
  ) {}

  @Get("me")
  myAttendance(@CurrentUser() user: AuthPrincipal) {
    if (!user.employeeId) throw new ForbiddenException("User is not linked to an employee");
    return this.attendanceHistory(user, user.employeeId, {});
  }

  @Get("me/next")
  @RequirePermissions("attendance.punch")
  async nextPunch(@CurrentUser() user: AuthPrincipal) {
    if (!user.employeeId) throw new ForbiddenException("User is not linked to an employee");
    return { type: await this.attendance.nextClockType(user.tenantId, user.employeeId, new Date()) };
  }

  @Get()
  @RequirePermissions("attendance.read")
  list(@CurrentUser() user: AuthPrincipal, @Query() range: AttendanceRangeDto) {
    return this.attendanceHistory(user, undefined, range);
  }

  private attendanceHistory(
    user: AuthPrincipal,
    employeeId: string | undefined,
    range: AttendanceRangeDto,
  ) {
    const from = range.from ? new Date(range.from) : undefined;
    const to = range.to ? new Date(range.to) : undefined;
    if (from && to && from > to) throw new BadRequestException("Invalid attendance date range");
    return this.prisma.attendance.findMany({
      where: {
        tenantId: user.tenantId,
        employeeId,
        punchedAt: { gte: from, lte: to },
      },
      orderBy: { punchedAt: "desc" },
      take: 500,
    });
  }

  @Post("punch")
  @RequirePermissions("attendance.punch")
  punch(@CurrentUser() user: AuthPrincipal, @Body() dto: PunchDto) {
    if (!user.employeeId) throw new ForbiddenException("User is not linked to an employee");
    return this.attendance.punch({
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      ...dto,
    });
  }

  @Post("face/verify")
  @RequirePermissions("attendance.punch")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  verifyFace(@CurrentUser() user: AuthPrincipal, @Body() dto: FaceVerificationDto) {
    if (!user.employeeId) throw new ForbiddenException("User is not linked to an employee");
    return this.faceVerification.verifyAndSave(user.tenantId, user.employeeId, dto.imageDataUrl);
  }
}
