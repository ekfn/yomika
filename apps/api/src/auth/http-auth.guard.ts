import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import type { CurrentUser } from "./auth.types";

type HttpRequestWithUser = Request & {
  currentUser?: CurrentUser;
};

@Injectable()
export class HttpAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HttpRequestWithUser>();
    const currentUser = await this.authService.getCurrentUser(request);

    if (!currentUser) {
      throw new UnauthorizedException("Authentication is required.");
    }

    request.currentUser = currentUser;

    return true;
  }
}
