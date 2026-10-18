import {
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { S3StorageService } from "../../storage/s3-storage.service";

@Controller("files")
class FilesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
  ) {}

  @Get(":id/download")
  async download(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const file = await this.prisma.storedFile.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!file || file.mimeType !== "application/pdf") throw new NotFoundException();

    const item = await this.prisma.payrollItem.findFirst({
      where: { payslipFileId: file.id, run: { tenantId: user.tenantId } },
      select: { employeeId: true },
    });
    if (!item) throw new NotFoundException();
    const canViewPayroll = user.permissions.includes("payroll.read");
    if (!canViewPayroll && (!user.employeeId || user.employeeId !== item.employeeId)) {
      throw new ForbiddenException();
    }

    const pdf = await this.storage.getObject(file.key);
    response
      .status(200)
      .set({
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": `attachment; filename="${file.id}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      })
      .send(pdf);
  }
}

@Module({ controllers: [FilesController] })
export class FilesModule {}
