import { Body, Controller, Get, Param, Patch, Post, UseGuards, Module, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { EVENTS } from "@krompay/shared";
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";

class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  title: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsIn(["KHR", "USD"])
  currency?: string;
}

class DecideExpenseDto {
  @IsIn(["APPROVED", "REJECTED"])
  status: "APPROVED" | "REJECTED";
}

@Controller("expenses")
@UseGuards(PermissionsGuard)
class ExpensesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.expenseClaim.findMany({
      where: {
        tenantId: user.tenantId,
        ...(user.permissions.includes("expense.approve") ? {} : { employeeId: user.employeeId ?? "" }),
      },
      include: {
        employee: { select: { id: true, employeeNo: true, firstNameEn: true, lastNameEn: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  @Post()
  async create(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: CreateExpenseDto,
  ) {
    if (!user.employeeId) throw new ForbiddenException("User is not linked to an employee");
    const row = await this.prisma.expenseClaim.create({
      data: {
        tenantId: user.tenantId,
        employeeId: user.employeeId,
        title: dto.title.trim(),
        amount: dto.amount,
        currency: dto.currency ?? "KHR",
      },
    });
    this.events.emit(EVENTS.EXPENSE_SUBMITTED, row);
    return row;
  }

  @Patch(":id/decide")
  @RequirePermissions("expense.approve")
  async decide(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body() body: DecideExpenseDto,
  ) {
    const result = await this.prisma.expenseClaim.updateMany({
      where: { id, tenantId: user.tenantId, status: "SUBMITTED" },
      data: { status: body.status },
    });
    if (!result.count) {
      const exists = await this.prisma.expenseClaim.findFirst({
        where: { id, tenantId: user.tenantId },
      });
      if (!exists) throw new NotFoundException();
      throw new BadRequestException("Expense claim is no longer pending");
    }
    return this.prisma.expenseClaim.findFirstOrThrow({
      where: { id, tenantId: user.tenantId },
    });
  }
}

@Module({ controllers: [ExpensesController] })
export class ExpensesModule {}
