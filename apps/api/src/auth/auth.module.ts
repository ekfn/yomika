import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RateLimitModule } from "@/rate-limit/rate-limit.module";
import { AuthGuard } from "./auth.guard";
import { AuthResolver } from "./auth.resolver";
import { AuthService } from "./auth.service";
import { HttpAuthGuard } from "./http-auth.guard";

@Module({
  imports: [JwtModule.register({}), RateLimitModule],
  providers: [AuthGuard, AuthResolver, AuthService, HttpAuthGuard],
  exports: [AuthGuard, AuthService, HttpAuthGuard],
})
export class AuthModule {}
