import { BadRequestException, Body, Controller, Get, Header, Headers, HttpCode, NotFoundException, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { BiometricService } from "./biometric.service";

@ApiTags("biometric")
@Controller("iclock")
export class BiometricController {
  constructor(private readonly biometric: BiometricService) {}

  /** Initial ADMS device handshake. Only registered, enabled device serials are acknowledged. */
  @Public()
  @Get("cdata")
  @Header("Content-Type", "text/plain; charset=utf-8")
  async handshake(@Query("SN") serial: string) {
    const device = await this.biometric.findEnabledDevice(serial);
    if (!device) throw new NotFoundException("Device is not registered");
    await this.biometric.acknowledgeDevice(serial);
    return `GET OPTION FROM: ${serial}\nStamp=0\nOpStamp=0\nPhotoStamp=0\nErrorDelay=30\nDelay=10\nTransFlag=AttLog\tOpLog\nRealtime=1\nEncrypt=0\n`;
  }

  /** Device heartbeat; command queue is intentionally empty until device-management commands are configured. */
  @Public()
  @Get("getrequest")
  @HttpCode(200)
  @Header("Content-Type", "text/plain; charset=utf-8")
  async poll(@Query("SN") serial: string) {
    await this.biometric.acknowledgeDevice(serial);
    return "OK";
  }

  @Public()
  @Post("cdata")
  @HttpCode(200)
  @Header("Content-Type", "text/plain; charset=utf-8")
  async ingest(
    @Body() body: unknown,
    @Query("SN") serial: string,
    @Query("table") table: string,
    @Headers("x-zk-signature") signature: string,
    @Headers("x-zk-timestamp") timestamp: string,
    @Headers("content-type") contentType: string,
  ) {
    if (contentType?.includes("application/json")) {
      const payload = body as { serialNumber?: unknown; pin?: unknown; punchedAt?: unknown; verifyMode?: unknown };
      const canonicalBody = JSON.stringify(payload);
      this.biometric.verifyWebhook(canonicalBody, signature ?? "", timestamp ?? "");
      if (typeof payload.serialNumber !== "string" || typeof payload.pin !== "string" || typeof payload.punchedAt !== "string") {
        throw new BadRequestException("Invalid compatibility payload");
      }
      await this.biometric.ingestPush(payload.serialNumber, payload.pin, new Date(payload.punchedAt), typeof payload.verifyMode === "number" ? payload.verifyMode : undefined);
      return "OK";
    }

    const rawBody = typeof body === "string" ? body : "";
    this.biometric.verifyWebhook(rawBody, signature ?? "", timestamp ?? "");
    if (!serial || !table) throw new NotFoundException("ADMS serial and table are required");
    if (table.toUpperCase() === "ATTLOG") {
      await this.biometric.ingestAttlog(serial, rawBody);
    } else {
      await this.biometric.acknowledgeDevice(serial);
    }
    return "OK";
  }

  @Public()
  @Post("devicecmd")
  @HttpCode(200)
  @Header("Content-Type", "text/plain; charset=utf-8")
  async acknowledge(
    @Body() body: unknown,
    @Query("SN") serial: string,
    @Headers("x-zk-signature") signature: string,
    @Headers("x-zk-timestamp") timestamp: string,
  ) {
    const rawBody = typeof body === "string" ? body : JSON.stringify(body ?? {});
    this.biometric.verifyWebhook(rawBody, signature ?? "", timestamp ?? "");
    await this.biometric.acknowledgeDevice(serial);
    return "OK";
  }
}
