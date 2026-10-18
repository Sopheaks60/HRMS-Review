import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { FaceVerificationService } from "./face-verification.service";

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, FaceVerificationService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
