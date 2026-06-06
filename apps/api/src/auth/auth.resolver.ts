import { UseGuards } from "@nestjs/common";
import { Args, Context, Mutation, Query, Resolver } from "@nestjs/graphql";
import { Throttle } from "@nestjs/throttler";
import type { GraphqlContext } from "@/graphql/graphql-context";
import { GraphqlThrottlerGuard } from "@/rate-limit/graphql-throttler.guard";
import { LOGIN_THROTTLE_OPTIONS } from "@/rate-limit/rate-limit.constants";
import { AuthService } from "./auth.service";
import type { CurrentUser } from "./auth.types";

type LoginInput = {
  password: string;
};

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Query("currentUser")
  currentUser(@Context() context: GraphqlContext): Promise<CurrentUser | null> {
    return this.authService.getCurrentUser(context.req);
  }

  @Mutation("login")
  @UseGuards(GraphqlThrottlerGuard)
  @Throttle(LOGIN_THROTTLE_OPTIONS)
  login(
    @Args("input") input: LoginInput,
    @Context() context: GraphqlContext,
  ): Promise<CurrentUser> {
    return this.authService.login(input.password, context.res);
  }

  @Mutation("logout")
  logout(@Context() context: GraphqlContext): boolean {
    return this.authService.logout(context.res);
  }
}
