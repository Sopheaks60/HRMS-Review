import { Body, Controller, Get, Patch, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsNumber, IsOptional, Max, Min } from "class-validator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { SettingsService, SystemParametersDto } from "./settings.service";

class UpdateExchangeRateDto {
  @IsNumber()
  @Min(1000)
  @Max(100000)
  usdToKhr: number;
}

@ApiTags("settings")
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("system-parameters")
  getSystemParameters() {
    return this.settingsService.getSystemParameters();
  }

  @Patch("exchange-rate")
  @RequirePermissions("org.write")
  updateExchangeRate(@Body() body: UpdateExchangeRateDto) {
    return this.settingsService.updateExchangeRate(body.usdToKhr);
  }

  @Put("system-parameters")
  @RequirePermissions("org.write")
  updateSystemParameters(@Body() body: SystemParametersDto) {
    return this.settingsService.updateSystemParameters(body);
  }
}
