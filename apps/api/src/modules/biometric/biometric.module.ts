import { Module } from "@nestjs/common";
import { AttendanceModule } from "../attendance/attendance.module";
import { BiometricController } from "./biometric.controller";
import { BiometricService } from "./biometric.service";

@Module({
  imports: [AttendanceModule],
  controllers: [BiometricController],
  providers: [BiometricService],
})
export class BiometricModule {}
