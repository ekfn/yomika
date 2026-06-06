import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { GraphqlThrottlerGuard } from "./graphql-throttler.guard";
import {
  LOGIN_THROTTLER_CONFIG,
  RATE_LIMIT_ERROR_MESSAGE,
} from "./rate-limit.constants";

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [LOGIN_THROTTLER_CONFIG],
      errorMessage: RATE_LIMIT_ERROR_MESSAGE,
    }),
  ],
  providers: [GraphqlThrottlerGuard],
  exports: [GraphqlThrottlerGuard],
})
export class RateLimitModule {}
