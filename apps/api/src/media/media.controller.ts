import type { Response } from "express";
import { Controller, Get, Param, Res, UseGuards } from "@nestjs/common";
import { HttpAuthGuard } from "@/auth/http-auth.guard";
import { MediaService } from "./media.service";

@Controller("media")
@UseGuards(HttpAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get("*mediaKey")
  getMedia(
    @Param("mediaKey") mediaKey: string[],
    @Res() response: Response,
  ): void {
    this.mediaService.sendMedia(mediaKey.join("/"), response);
  }
}
