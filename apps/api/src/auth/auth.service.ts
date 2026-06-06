import type { Request, Response } from "express";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { loadAppConfig } from "@/config/app-config";
import {
  CURRENT_USER,
  type CurrentUser,
  type SessionPayload,
} from "./auth.types";

type CookieRequest = Request & {
  cookies?: Record<string, string | undefined>;
};

@Injectable()
export class AuthService {
  private readonly config = loadAppConfig();

  constructor(private readonly jwtService: JwtService) {}

  async login(password: string, response: Response): Promise<CurrentUser> {
    if (password !== this.config.appPassword) {
      throw new UnauthorizedException("Invalid password.");
    }

    const token = await this.jwtService.signAsync(
      {
        sub: CURRENT_USER.id,
        label: CURRENT_USER.label,
      } satisfies SessionPayload,
      {
        secret: this.config.sessionSecret,
      },
    );

    response.cookie(this.config.accessTokenCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.authCookieSecure,
      path: "/",
    });

    return CURRENT_USER;
  }

  logout(response: Response): boolean {
    response.clearCookie(this.config.accessTokenCookieName, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.authCookieSecure,
      path: "/",
    });

    return true;
  }

  async getCurrentUser(request: Request): Promise<CurrentUser | null> {
    const token = (request as CookieRequest).cookies?.[
      this.config.accessTokenCookieName
    ];

    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<SessionPayload>(token, {
        secret: this.config.sessionSecret,
      });

      if (
        payload.sub !== CURRENT_USER.id ||
        payload.label !== CURRENT_USER.label
      ) {
        return null;
      }

      return CURRENT_USER;
    } catch {
      return null;
    }
  }
}
