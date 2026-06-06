import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import type { GraphqlContext } from "@/graphql/graphql-context";
import { AuthService } from "./auth.service";
import type { CurrentUser } from "./auth.types";

export type AuthenticatedRequest = GraphqlContext["req"] & {
  currentUser: CurrentUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const graphqlContext =
      GqlExecutionContext.create(context).getContext<GraphqlContext>();
    const currentUser = await this.authService.getCurrentUser(
      graphqlContext.req,
    );

    if (!currentUser) {
      throw new UnauthorizedException("Authentication is required.");
    }

    (graphqlContext.req as AuthenticatedRequest).currentUser = currentUser;

    return true;
  }
}
