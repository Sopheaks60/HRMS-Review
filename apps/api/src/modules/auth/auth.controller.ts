import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser, type AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { AuthService } from "./auth.service";

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10)
  password: string;

  @IsString()
  tenantSlug: string;
}

class RefreshDto {
  @IsString()
  refreshToken: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("me")
  me(@CurrentUser() user: AuthPrincipal) {
    return user;
  }

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password, dto.tenantSlug);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
